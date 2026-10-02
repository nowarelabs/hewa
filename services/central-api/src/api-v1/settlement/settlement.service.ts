import { Inject, Injectable } from "@nestjs/common";
import type {
  ConsoleEnvelope,
  Payout,
  Settlement,
  SettlementKind,
  SettlementRun,
} from "@hewa/console-types";
import { money, type Currency, type TransactionStatus } from "@hewa/marketplace-types";
import { asc, desc, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { instant } from "../../db/instant.js";
import { settlementKindEnum, settlements, transactionStatusEnum } from "../../db/schema.js";
import { settlementRecord } from "../data/records.js";
import { envelope } from "../envelope.js";

/** A settlement row, as it comes back from any of the three sections' queries. */
type Row = typeof settlements.$inferSelect;

@Injectable()
export class SettlementService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `settlement/movements`: every movement of value, newest first.
   *
   * Grouped by `kind` and not by `status`, which is the one that changes on its own:
   * a `status` vocabulary would build chips for states this run has not reached, and
   * an operator pressing "pending" on a batch that cleared an hour ago is asking a
   * question about time rather than about the middle of the settlement process.
   * `kind` is what an operator says they want — the clearing run, this flow, the
   * escrow, last month's payout — and it is stable across the life of a line.
   *
   * `status` is still carried on every row, so the chip and the column coexist; the
   * bar just does not pretend the two are the same axis.
   */
  async readMovements(): Promise<ConsoleEnvelope<Settlement[], SettlementKind>> {
    const rows = await this.readRows(desc(settlements.occurredAt));

    const lines: Settlement[] = rows.map(settlementRecord);

    return envelope(lines, settlementKindEnum.enumValues as SettlementKind[]);
  }

  /**
   * `settlement/runs`: one row per batch *and currency*.
   *
   * The pair is the whole point. A batch holding a USD clearing line and a USDC
   * micro-payment has no net, no gross and no fee total — those would be sums of two
   * currencies, which is a number in minor units of nothing, and a batch total is
   * exactly the figure an operator uses to decide whether a run balanced. Splitting
   * by currency makes the impossible sum impossible to express rather than merely
   * easy to get wrong.
   *
   * `gross`, `fees` and `net` are computed by the database from the same rows and
   * in the same query, so the totals and the line count cannot disagree.
   */
  async readRuns(): Promise<ConsoleEnvelope<SettlementRun[], never>> {
    const rows = await this.db
      .select({
        batch: settlements.batch,
        currency: settlements.currency,
        kinds: sql<
          SettlementKind[]
        >`array_agg(distinct ${settlements.kind}::text order by ${settlements.kind}::text)`,
        lineCount: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${settlements.status} <> 'completed')::int`,
        grossMinor: sql<string>`sum(${settlements.amountMinor})::text`,
        feesMinor: sql<string>`sum(${settlements.feeMinor})::text`,
        startedAt: sql<Date | string>`min(${settlements.occurredAt})`,
        completedAt: sql<
          Date | string | null
        >`max(${settlements.occurredAt}) filter (where ${settlements.status} = 'completed')`,
      })
      .from(settlements)
      .groupBy(settlements.batch, settlements.currency)
      // Newest batch first, and alphabetical within one, so a batch split across two
      // currencies is two adjacent rows rather than two rows at opposite ends of
      // the table.
      .orderBy(desc(sql`max(${settlements.occurredAt})`), asc(settlements.currency));

    const runs: SettlementRun[] = rows.map((row) => {
      const currency = row.currency as Currency;
      const gross = Number(row.grossMinor);
      const fees = Number(row.feesMinor);
      return {
        batch: row.batch,
        currency,
        kinds: row.kinds,
        lineCount: row.lineCount,
        failed: row.failed,
        gross: money(gross, currency),
        fees: money(fees, currency),
        // The subtraction a settlement run signs off on, done here rather than in
        // the panel so that a table showing gross and fees and a column showing net
        // are three views of one number.
        net: money(gross - fees, currency),
        startedAt: instant(row.startedAt),
        completedAt: row.completedAt === null ? null : instant(row.completedAt),
      };
    });

    // No group vocabulary: a run is already one row per batch, so a chip built from
    // its groups would filter rows by the key they are selected by.
    return envelope(runs, []);
  }

  /**
   * `settlement/payouts`: money leaving for an ISP.
   *
   * `kind = 'payout'` in the query rather than a JavaScript `filter` afterwards,
   * because the service must not read a batch of clearing lines it has already
   * decided not to show. The two extra columns — `net` and `failureReason` — are
   * what the movements list cannot give an operator asking whether the money
   * arrived, and why the ones that did not did not.
   */
  async readPayouts(): Promise<ConsoleEnvelope<Payout[], Settlement["status"]>> {
    const rows = await this.db
      .select()
      .from(settlements)
      .where(sql`${settlements.kind} = 'payout'`)
      .orderBy(desc(settlements.occurredAt), asc(settlements.id));

    const payouts: Payout[] = rows.map((row) => ({
      id: row.id,
      batch: row.batch,
      counterparty: row.counterparty,
      amount: money(row.amountMinor, row.currency),
      fee: money(row.feeMinor, row.currency),
      net: money(row.amountMinor - row.feeMinor, row.currency),
      status: row.status,
      occurredAt: row.occurredAt.toISOString(),
      failureReason: row.failureReason,
    }));

    // Grouped by status here rather than by kind, because every row is a payout and
    // a chip for "payout" would select the table it is printed above. The list is
    // the `ENUM`'s own value list for the same reason the nodes section reads its
    // kinds from `nodeKindEnum`: a hand-written copy is a second truth that is
    // right until a status is added to one of them.
    return envelope(payouts, transactionStatusEnum.enumValues as TransactionStatus[]);
  }

  /** One ordered read shared by two sections. */
  private readRows(order: ReturnType<typeof desc>): Promise<Row[]> {
    return this.db.select().from(settlements).orderBy(order, asc(settlements.id));
  }
}
