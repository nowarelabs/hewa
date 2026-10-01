import { Inject, Injectable } from "@nestjs/common";
import type { ConsoleEnvelope, Settlement, SettlementKind } from "@hewa/console-types";
import { money } from "@hewa/marketplace-types";
import { asc, desc } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { settlementKindEnum, settlements } from "../../db/schema.js";
import { envelope } from "../envelope.js";

@Injectable()
export class SettlementService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Every movement of value, newest first.
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
  async read(): Promise<ConsoleEnvelope<Settlement[], SettlementKind>> {
    const rows = await this.db
      .select()
      .from(settlements)
      .orderBy(desc(settlements.occurredAt), asc(settlements.id));

    const lines: Settlement[] = rows.map((row) => ({
      id: row.id,
      batch: row.batch,
      kind: row.kind,
      status: row.status,
      counterparty: row.counterparty,
      // Signed and read straight from a `bigint`, so a credit stays negative and the
      // column sums with the sign the ledger wrote.
      amount: money(row.amountMinor, row.currency),
      // Never negative: the `CHECK` on the column refuses it, so the one thing a
      // panel cannot be handed is a fee that credits the ISP.
      fee: money(row.feeMinor, row.currency),
      occurredAt: row.occurredAt.toISOString(),
      // `null` when the line did not fail, which the panel renders as a dash. Not
      // an empty string, which would render as the same dash and mean nothing.
      failureReason: row.failureReason,
    }));

    return envelope(lines, settlementKindEnum.enumValues as SettlementKind[]);
  }
}
