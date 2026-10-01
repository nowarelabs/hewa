import { Inject, Injectable } from "@nestjs/common";
import type { ConsoleEnvelope, SlaMonitor } from "@hewa/console-types";
import { slaCommitment, type SlaState } from "@hewa/marketplace-types";
import { asc, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { slaMonitors, slaStateEnum } from "../../db/schema.js";
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

@Injectable()
export class SlasService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Every monitored commitment, and the state each one is in.
   *
   * `state` is read from the column and not recomputed here. It is stored because
   * the same comparison decides whether a settlement run issues a credit: two copies
   * of a rule that decides money is how a commitment ends up "breached" on a screen
   * and absent from an invoice. `slaState` in `@hewa/marketplace-types` is the
   * single definition, this column is where its answer is recorded, and
   * `tests/slas.service.test.ts` asserts the two agree for every row — so a rule
   * changed in one place and not the other fails a test instead of quietly issuing
   * the wrong credits.
   */
  async read(): Promise<ConsoleEnvelope<SlaMonitor[], SlaState>> {
    const rows = await this.db
      .select()
      .from(slaMonitors)
      .orderBy(asc(worstFirst), asc(slaMonitors.id));

    const monitors: SlaMonitor[] = rows.map((row) => ({
      id: row.id,
      account: row.account,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      provider: row.provider,
      sla: slaCommitment(row.targetBps, row.actualBps, row.creditNumerator, row.creditDenominator),
      packetLossPpm: row.packetLossPpm,
      latencyP95Ms: row.latencyP95Ms,
      state: row.state,
      measuredAt: row.measuredAt.toISOString(),
    }));

    return envelope(monitors, slaStateEnum.enumValues as SlaState[]);
  }
}
