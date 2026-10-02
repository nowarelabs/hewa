import { Inject, Injectable } from "@nestjs/common";
import type {
  ConsoleEnvelope,
  SlaCredit,
  SlaMonitor,
  SlaRisk,
  SlaState,
} from "@hewa/console-types";
import { creditablePoints, slaCommitment } from "@hewa/marketplace-types";
import { asc, desc, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { slaMonitors, slaStateEnum } from "../../db/schema.js";
import { monitorRecord } from "../data/records.js";
import { envelope } from "../envelope.js";

/**
 * Which commitments are the ones being looked at: everything that is not meeting
 * its target, worst first.
 *
 * A SQL `order by` rather than sorting the mapped rows in JavaScript, so the
 * ordering is the database's and the rows do not have to be read into memory to be
 * put in order. `actual_bps / target_bps` is a `numeric` division, so a target of
 * 9_999 does not overflow into a float and reorder the top of the table.
 */
const worstFirst = sql`${slaMonitors.actualBps}::numeric / greatest(${slaMonitors.targetBps}, 1)`;

/**
 * Basis points below target, floored at zero.
 *
 * `greatest(…, 0)` rather than a bare subtraction because a compliant commitment
 * has a *negative* shortfall, and a risk list that starts with `-3` — meaning the
 * target is being beaten by three basis points — reads as a shortfall in the wrong
 * direction. Zero is the honest floor: nothing is missing.
 */
const shortfallBps = sql<number>`greatest(${slaMonitors.targetBps} - ${slaMonitors.actualBps}, 0)::int`;

@Injectable()
export class SlasService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `slas/commitments`: every monitored commitment, and the state each one is in.
   *
   * `state` is read from the column and not recomputed here. It is stored because
   * the same comparison decides whether a settlement run issues a credit: two copies
   * of a rule that decides money is how a commitment ends up "breached" on a screen
   * and absent from an invoice. `slaState` in `@hewa/marketplace-types` is the
   * single definition, this column is where its answer is recorded, and
   * `tests/slas.service.test.ts` asserts the two agree for every row — so a rule
   * changed in one place and not the other fails a test instead of quietly issuing
   * the wrong credits.
   *
   * Sorted worst-first rather than by name, because this section is the one an
   * operator opens to find out what is broken.
   */
  async readCommitments(): Promise<ConsoleEnvelope<SlaMonitor[], SlaState>> {
    const rows = await this.readRows();

    const monitors: SlaMonitor[] = rows.map(monitorRecord);

    return envelope(monitors, slaStateEnum.enumValues as SlaState[]);
  }

  /**
   * `slas/at_risk`: the commitments closest to their threshold.
   *
   * Only the two states that are not compliant, which is what makes this a
   * different section rather than the commitments list sorted differently: a
   * compliant commitment cannot be at risk, and including it would put nine rows of
   * "everything is fine" above the one row that is not.
   *
   * `trendBps` is the shortfall against the *previous* measurement of the same
   * commitment, read with a window function in the same query. `LAG` over
   * `PARTITION BY id ORDER BY measured_at` is what makes it the previous
   * measurement of this commitment rather than the previous row in the table,
   * which would be a different commitment's reading entirely.
   */
  async readAtRisk(): Promise<ConsoleEnvelope<SlaRisk[], SlaState>> {
    const rows = await this.db
      .select({
        id: slaMonitors.id,
        account: slaMonitors.account,
        nodeId: slaMonitors.nodeId,
        nodeName: slaMonitors.nodeName,
        provider: slaMonitors.provider,
        state: slaMonitors.state,
        targetBps: slaMonitors.targetBps,
        actualBps: slaMonitors.actualBps,
        creditNumerator: slaMonitors.creditNumerator,
        creditDenominator: slaMonitors.creditDenominator,
        measuredAt: slaMonitors.measuredAt,
        shortfallBps,
        previousShortfallBps: sql<number | null>`lag(${shortfallBps}) over (
          partition by ${slaMonitors.id} order by ${slaMonitors.measuredAt}
        )::int`,
      })
      .from(slaMonitors)
      .where(sql`${slaMonitors.state} <> 'compliant'`)
      // The gap that is widening first, then the widest gap, then by name so two
      // commitments at the same gap keep a stable order between loads.
      .orderBy(
        sql`coalesce((${shortfallBps} - lag(${shortfallBps}) over (
          partition by ${slaMonitors.id} order by ${slaMonitors.measuredAt}
        )), 0) desc`,
        desc(worstFirst),
        asc(slaMonitors.id),
      );

    const risks: SlaRisk[] = rows.map((row) => ({
      id: row.id,
      account: row.account,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      provider: row.provider,
      state: row.state,
      sla: slaCommitment(row.targetBps, row.actualBps, row.creditNumerator, row.creditDenominator),
      shortfallBps: row.shortfallBps,
      // `0` when there is no previous measurement, because one reading is not a
      // trend and a first-seen commitment is not "stable".
      trendBps: row.previousShortfallBps === null ? 0 : row.shortfallBps - row.previousShortfallBps,
      measuredAt: row.measuredAt.toISOString(),
    }));

    return envelope(risks, slaStateEnum.enumValues as SlaState[]);
  }

  /**
   * `slas/credits`: what each shortfall would cost.
   *
   * ## Why there is no `Money` in this payload
   *
   * A credit is a fraction of a bill, and this service holds no bills. What it
   * holds is commitments, and what a commitment cost is the settlement view's
   * question — so publishing an amount here would mean multiplying a rate by a base
   * nobody named. That produces a confident figure which is wrong, and wrong in the
   * one direction an operator would act on.
   *
   * So the rate travels as the exact fraction it is stored as, and the
   * `creditablePoints` that `creditablePoints()` computes from it are the part that
   * is knowable here. Both are integers and neither is rounded on the way through:
   * the credit rate is a `numerator / denominator` pair precisely so that a
   * percentage of an exact base is still exact.
   *
   * Compliant commitments are included, with zero points. A credit table that hides
   * the accounts being paid correctly cannot answer "who was compensated", and the
   * answer is mostly nobody.
   */
  async readCredits(): Promise<ConsoleEnvelope<SlaCredit[], SlaState>> {
    const rows = await this.readRows();

    const credits: SlaCredit[] = rows.map((row) => ({
      commitmentId: row.id,
      account: row.account,
      nodeName: row.nodeName,
      provider: row.provider,
      state: row.state,
      targetBps: row.targetBps,
      actualBps: row.actualBps,
      creditablePoints: creditablePoints(
        slaCommitment(row.targetBps, row.actualBps, row.creditNumerator, row.creditDenominator),
      ),
      creditNumerator: row.creditNumerator,
      creditDenominator: row.creditDenominator,
      measuredAt: row.measuredAt.toISOString(),
    }));

    return envelope(credits, slaStateEnum.enumValues as SlaState[]);
  }

  /**
   * Every monitor row, worst first.
   *
   * Three sections read the same columns and none of them reads them its own way,
   * so the ordering and the projection live here rather than being spelled out
   * three times.
   */
  private readRows(): Promise<(typeof slaMonitors.$inferSelect)[]> {
    return this.db.select().from(slaMonitors).orderBy(asc(worstFirst), asc(slaMonitors.id));
  }
}
