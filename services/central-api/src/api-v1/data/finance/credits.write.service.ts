import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { CreditCreate, CreditRecord } from "@hewa/financial-dashboard-types";
import { eq } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { financeBills, financeCredits } from "../../../db/schema.js";
import { creditRecord } from "../../finance/records.js";
import { write } from "../write-errors.js";
import { inserted } from "../write-support.js";

/**
 * Record a credit against a bill.
 *
 * ## Why this is the only finance write with no patch
 *
 * Because a credit is a decision, not a document state. `finance_credits` is a
 * signed, dated, reasoned record that money was given back, and editing one is not
 * the same kind of act as moving a bill from `issued` to `disputed`: there is no
 * state a credit can be in, so there is no transition, so there is nothing for a
 * `PATCH` to do. Correcting a credit is a second credit against the same bill, and
 * the note on it says why — which leaves `revenue/credits` holding both, the way a
 * ledger holds a reversal beside the thing it reverses.
 *
 * That is also why `CreditPatch = never` and `CreditUpsert = never` in the contract:
 * the absence is stated in one place and the routes below are what honour it.
 *
 * ## Why the bill is read and the credit inserted separately
 *
 * Two statements, and not because the join is awkward. `finance_credits` holds no
 * `ispId`, `ispName`, `month` or `currency` — they are the bill's — so the response
 * cannot be built from the inserted row alone, and the read is what fills in the four
 * columns the table deliberately does not store. Two statements in sequence, the
 * second depending on the first, and *that* is the one thing here worth being careful
 * about: a credit whose bill read fails leaves nothing written, and a credit whose
 * response read fails leaves the credit written and the caller seeing an error it may
 * retry. So the read happens **first** and the insert second, and the insert's only
 * foreign key is the bill the read already found. There is no transaction here
 * because there is nothing to roll back — the write is one row into one table.
 */
@Injectable()
export class CreditsWriteService {
  static readonly RESOURCE = "credit";

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `POST /api/v1/data/credits`.
   *
   * The `amountMinor` sign is checked by the write schema, so a positive "credit"
   * never reaches this function: a charge under a column named after a reduction is
   * the one figure whose sign `revenue/receivables` silently depends on.
   */
  async create(body: CreditCreate): Promise<CreditRecord> {
    const bill = await this.readBill(body.billId);

    const credit = inserted(
      await write(CreditsWriteService.RESOURCE, () =>
        this.db
          .insert(financeCredits)
          .values({
            id: body.id,
            billId: body.billId,
            amountMinor: body.amountMinor,
            basis: body.basis,
            note: body.note,
            recordedAt: new Date(body.recordedAt),
          })
          .returning(),
      ),
      CreditsWriteService.RESOURCE,
      body.id,
    );

    return creditRecord({ ...bill, ...credit });
  }

  /**
   * The bill a credit is taken off, or a 404 naming it.
   *
   * A 404 rather than a 422 for the foreign-key case the insert would have reported,
   * because the caller asked for a credit against *a bill* and there is none: that is
   * a missing resource, and the message says which id was not found.
   */
  private async readBill(billId: string) {
    const rows = await this.db
      .select()
      .from(financeBills)
      .where(eq(financeBills.id, billId))
      .limit(1);
    const bill = rows[0];
    if (bill === undefined) {
      throw new NotFoundError("bill", billId);
    }
    return bill;
  }
}
