import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { PayoutPatch, PayoutRecord, PayoutStatus } from "@hewa/financial-dashboard-types";
import { assertPayoutTransition } from "@hewa/settlement-domain";
import { eq } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { financePayouts } from "../../../db/schema.js";
import { payoutRecord } from "../../finance/records.js";
import { write } from "../write-errors.js";
import { defined, updated } from "../write-support.js";

/**
 * Move a payout along its rail.
 *
 * ## The transition table is the domain's
 *
 * `assertPayoutTransition` from `@hewa/settlement-domain` throws a `ValidationError`
 * carrying `{ from, to }`, and this service does not wrap it or restate it. A payout
 * is money leaving through a rail that has states, and the states are a fact about
 * that rail rather than about this dashboard — the settlement pipeline moves them with
 * the same call the dashboard's editor does, which is why one rule and not two.
 *
 * ## `failureReason` goes in the same statement
 *
 * A payout is `failed` or it is not, and the column says so both ways: no reason
 * without a failure, no failure without a reason. Marking a payout failed is therefore
 * never one field — it is the status *and* the reason, written together — and a form
 * that submitted them separately would leave a failed payout with no reason for the
 * length of a round trip.
 */
@Injectable()
export class PayoutsWriteService {
  static readonly RESOURCE = "payout";

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `PATCH /api/v1/data/payouts/:id`.
   *
   * 404 when the id is not a payout. 422 when the move is not on the rail — which
   * the domain throws as `{ from, to }`, so the caller is told which transition was
   * refused rather than that "the status is invalid".
   */
  async patch(id: string, patch: PayoutPatch): Promise<PayoutRecord> {
    const current = await this.readRow(id);
    assertPayoutTransition(current.status as PayoutStatus, patch.status);

    const columns = defined({
      status: patch.status,
      // `status` is required on this patch, so the two columns are always in step:
      // a reason arrives with `failed` and every other move sends `null`, which is
      // what a retry out of `failed` needs — the old reason described the attempt
      // that was abandoned.
      failureReason: patch.status === "failed" ? (patch.failureReason ?? null) : null,
    });

    const row = updated(
      await write(PayoutsWriteService.RESOURCE, () =>
        this.db.update(financePayouts).set(columns).where(eq(financePayouts.id, id)).returning(),
      ),
      PayoutsWriteService.RESOURCE,
      id,
    );
    return payoutRecord(row);
  }

  /** The payout a transition is measured against, or a 404 naming it. */
  private async readRow(id: string): Promise<typeof financePayouts.$inferSelect> {
    const rows = await this.db
      .select()
      .from(financePayouts)
      .where(eq(financePayouts.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(PayoutsWriteService.RESOURCE, id);
    }
    return row;
  }
}
