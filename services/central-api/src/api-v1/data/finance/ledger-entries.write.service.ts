import { Inject, Injectable } from "@nestjs/common";
import { ValidationError } from "@hewa/errors";
import type { Currency } from "@hewa/marketplace-types";
import { money } from "@hewa/marketplace-types";
import { journalEntry, posting, type Account } from "@hewa/ledger-accounting";
import type { LedgerEntryCreate, LedgerEntryRecord } from "@hewa/financial-dashboard-types";
import { inArray } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import {
  financeLedgerAccounts,
  financeLedgerEntries,
  financeLedgerPostings,
} from "../../../db/schema.js";
import { accountRecords, ledgerEntryRecord } from "../../finance/records.js";
import { write } from "../write-errors.js";
import { inserted } from "../write-support.js";

/**
 * Post a journal entry.
 *
 * ## Four steps, and each one is a refusal somebody would rather make here
 *
 * 1. **Resolve the accounts.** Every `accountId` in the body must name an account in
 *    the chart *in the entry's currency*. The foreign key would catch a missing one;
 *    nothing would catch a KES account posted with USD minor units, and that entry
 *    foots — `totalsFor` skips other currencies rather than converting, so it reports
 *    zero on both sides and calls itself balanced. One query answers all three
 *    questions a leg raises: does it exist, what is it called, what currency is it.
 * 2. **Balance the legs.** `journalEntry` from `@hewa/ledger-accounting` asserts it,
 *    which is that package's whole reason to exist and not something to reimplement
 *    in a write path.
 * 3. **Write the entry and its legs in one transaction.** This is the only finance
 *    write with two tables. An entry with no legs, or legs with no entry, is not a
 *    half-written journal entry — it is a half-written one, and the ledger reads by
 *    joining the two, so the orphan is invisible in one section and a total in
 *    another. PGlite and PostgreSQL both give a transaction per statement when there
 *    is not one, so the alternative is a ledger that can be half-written.
 * 4. **Answer from what was written**, through the same `ledgerEntryRecord` the
 *    section uses, so a response and a row in `ledger/ledger` are the same object
 *    rather than two renderings of it.
 *
 * ## Why there is no `PATCH` and no `DELETE`
 *
 * Because an entry is not edited. The schema says so on the table — there is no
 * `updatedAt`, because there is no second value for it to hold — and a correction is
 * a second, reversing entry. A `DELETE` would be worse than useless: it would remove
 * the half of a pair that balances.
 */
@Injectable()
export class LedgerEntriesWriteService {
  static readonly RESOURCE = "ledger entry";

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `POST /api/v1/data/ledger_entries`.
   *
   * 409 when the `reference` or the id is already posted — `reference` is unique and
   * is what a retrying pipeline has, so the same reference arriving twice is the
   * duplicate the caller wanted to know about rather than a second entry.
   *
   * 422 when the legs do not balance, when a leg names an account that is not in the
   * chart, or when a leg's account is in another currency than the entry.
   */
  async create(body: LedgerEntryCreate): Promise<LedgerEntryRecord> {
    const currency = body.currency as Currency;
    const accounts = await this.accounts(
      body.postings.map((leg) => leg.accountId),
      currency,
    );
    const nameByAccount = new Map(accounts.map((account) => [account.id, account.name]));

    const postings = body.postings.map((leg) =>
      posting(leg.accountId, money(leg.amountMinor, currency)),
    );
    const entry = journalEntry(
      body.id,
      body.reference,
      body.occurredAt,
      body.description,
      postings,
    );

    await write(LedgerEntriesWriteService.RESOURCE, async () => {
      await this.db.transaction(async (tx) => {
        inserted(
          await tx
            .insert(financeLedgerEntries)
            .values({
              id: entry.id,
              reference: entry.reference,
              description: entry.description,
              occurredAt: new Date(entry.occurredAt),
              currency,
            })
            .returning(),
          LedgerEntriesWriteService.RESOURCE,
          entry.id,
        );
        await tx.insert(financeLedgerPostings).values(
          entry.postings.map((leg) => ({
            entryId: entry.id,
            accountId: leg.accountId,
            amountMinor: leg.amount.amountMinor,
          })),
        );
      });
    });

    return ledgerEntryRecord(entry, nameByAccount, currency);
  }

  /**
   * The chart accounts a body names, in the entry's currency, or a 422.
   *
   * ## Two refusals, and both are about the leg rather than the entry
   *
   * - **An id the chart does not hold.** The foreign key would say `23503` and the
   *   caller would learn that *a* constraint fired; this says which account is not
   *   there, which is the field they can fix.
   * - **An account in another currency.** `finance_ledger_postings` has one
   *   `amount_minor` and no currency of its own, so the entry's currency is the
   *   leg's currency — and a leg that quietly disagrees with its own column is how a
   *   KES account ends up with a balance in dollars that still foots. Checked here
   *   because the schema cannot: an account's currency is a property of a *row* in
   *   the chart, and a payload validator that had to know the chart would be a second
   *   copy of it.
   *
   * Deduplicated with a `Set`, because two legs of one entry may name the same
   * account and the query should not ask twice.
   */
  private async accounts(accountIds: readonly string[], currency: Currency): Promise<Account[]> {
    const wanted = [...new Set(accountIds)];
    const rows = await this.db
      .select()
      .from(financeLedgerAccounts)
      .where(inArray(financeLedgerAccounts.id, wanted));

    const accounts = accountRecords(rows);
    const byId = new Map(accounts.map((account) => [account.id, account]));

    for (const id of wanted) {
      const account = byId.get(id);
      if (account === undefined) {
        throw new ValidationError("Posting names an account that is not in the chart", {
          accountId: id,
        });
      }
      if (account.currency !== currency) {
        throw new ValidationError("Posting names an account in another currency", {
          accountId: id,
          accountCurrency: account.currency,
          entryCurrency: currency,
        });
      }
    }

    return accounts;
  }
}
