import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError, ValidationError } from "@hewa/errors";
import {
  canTransitionBill,
  type Bill,
  type BillPatch,
  type BillStatus,
} from "@hewa/financial-dashboard-types";
import { eq } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { financeBills } from "../../../db/schema.js";
import { billRecord } from "../../finance/records.js";
import { write } from "../write-errors.js";
import { defined, updated } from "../write-support.js";

/**
 * Change a bill's status, and nothing else.
 *
 * ## Why only `status` and `disputeReason`
 *
 * Because a bill is an invoice, and an invoice is not edited. Changing a charge on
 * an issued bill means the charge was wrong, and the correction is a credit, a
 * reversal entry, or a new bill for the month — all of which are rows somebody can
 * read. A `PATCH` that could move `commitmentChargeMinor` would let a month be
 * re-priced after the fact with nothing in the record saying so, and the receivables
 * figure would move for a reason no reader could find.
 *
 * So there is no `PUT` and no `DELETE` either, and the absence is the statement: a
 * `void` bill is withdrawn, with a date on the row and its reason in the audit of who
 * voided it, and nothing in this workspace removes an invoice.
 */
@Injectable()
export class BillsWriteService {
  static readonly RESOURCE = "bill";

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `PATCH /api/v1/data/bills/:id`.
   *
   * ## The transition is checked before anything is read
   *
   * `canTransitionBill` lives in `@hewa/financial-dashboard-types` rather than here,
   * because the editor needs the same table to decide which statuses to offer. A rule
   * duplicated into this service would be a second copy, and the copy that drifts is
   * the one that makes the dashboard offer a move the service refuses.
   *
   * ## A patch that changes nothing returns the row as it stands
   *
   * `defined` drops the keys the body did not mention, and an empty `set` would be a
   * no-op query that `updated` cannot tell from "matched no row" — so the row is read
   * back instead of answering `undefined`. The client then renders the row it asked
   * about, which is the same thing it would have rendered had the patch been refused
   * for being empty.
   */
  async patch(id: string, patch: BillPatch): Promise<Bill> {
    const current = await this.readRow(id);

    if (patch.status !== undefined) {
      this.assertTransition(current.status, patch.status);
    }

    const columns = defined({
      status: patch.status,
      disputeReason: patch.disputeReason,
    });

    if (Object.keys(columns).length === 0) {
      return billRecord(current);
    }

    // Clearing a reason without leaving `disputed` is refused here, naming the field,
    // rather than left to `finance_bills_dispute_reason_iff_disputed` — which answers
    // with the name of a constraint, on a row whose dispute would have lost its only
    // explanation in exchange. The move that clears it is the move out of `disputed`,
    // and the schema is what pairs the two.
    if (
      patch.status === undefined &&
      current.status === "disputed" &&
      patch.disputeReason === null
    ) {
      throw new ValidationError("A disputed bill needs a reason", {
        disputeReason: "clear it by moving the bill out of disputed",
      });
    }

    const row = updated(
      await write(BillsWriteService.RESOURCE, () =>
        this.db.update(financeBills).set(columns).where(eq(financeBills.id, id)).returning(),
      ),
      BillsWriteService.RESOURCE,
      id,
    );
    return billRecord(row);
  }

  /** The row a patch is measured against, or a 404 naming it. */
  private async readRow(id: string): Promise<typeof financeBills.$inferSelect> {
    const rows = await this.db.select().from(financeBills).where(eq(financeBills.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      // `updated` would have thrown the same 404 one statement later, but only if the
      // transition check had passed — and the transition check needs the current
      // status, so the read comes first and this is where the absence is found.
      throw new NotFoundError(BillsWriteService.RESOURCE, id);
    }
    return row;
  }

  /**
   * One move, or a 422 that names both ends of it.
   *
   * A `ValidationError` with `{ from, to }` rather than with the pair's position, so
   * the caller can say "a paid bill does not go back to issued" without having to
   * reconstruct which bill it was about — the same shape
   * `assertPayoutTransition` throws from `@hewa/settlement-domain`.
   *
   * Re-sending the status a bill already has is allowed, because it is how an editor
   * that saves the whole row behaves: a form that posts `status` on every save would
   * otherwise be a 422 for saving a bill nobody changed.
   */
  private assertTransition(from: BillStatus, to: BillStatus): void {
    if (from === to || canTransitionBill(from, to)) {
      return;
    }
    throw new ValidationError("Illegal bill status transition", { from, to });
  }
}
