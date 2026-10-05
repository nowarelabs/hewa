import { ACCOUNT_TYPES, ACCOUNT_TYPE_TITLES, type AccountType } from "@hewa/ledger-accounting";
import type { Currency, Money } from "@hewa/marketplace-types";

/**
 * The ledger: one row per account, with the balance that account currently carries.
 *
 * `AccountType` is `@hewa/ledger-accounting`'s, and so is the notion of a normal
 * side — the package is where `asset` means debit and `revenue` means credit, and
 * re-deriving that here would give the dashboard a balance sign convention of its
 * own. The failure is quiet and total: every figure in the panel would be right
 * about the accounts and wrong about what a balance means, and the trial balance
 * would still foot, because two sign errors are not a visible error at all.
 */
export { ACCOUNT_TYPES, ACCOUNT_TYPE_TITLES };
export type { AccountType };

/**
 * One ledger account and its balance.
 *
 * `balance` is on the **normal** side: an asset's balance is what it holds, and a
 * revenue account's is what it earned, both positive, and whether that is a debit
 * or a credit is `normalSide`'s job. Signed balances are the other convention and
 * they are not interchangeable — a reader who has learned one and meets the other
 * reads every total on the screen as having the wrong sign.
 *
 * `debit` and `credit` are the period totals the balance is built from, so the
 * figure a reader cannot check — the balance — arrives with the two numbers it is
 * the difference of.
 */
export interface LedgerAccount {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  /** `debit` for an asset or an expense, `credit` for a liability, revenue or equity. */
  readonly normalSide: "debit" | "credit";
  readonly debit: Money;
  readonly credit: Money;
  /** `debit - credit` for a debit-side account, and the reverse for a credit-side one. */
  readonly balance: Money;
}

/**
 * One side of a journal entry, as a row.
 *
 * `accountName` travels beside `accountId` for the reason every record here does:
 * the name is what a reader reads, and resolving it at draw time means an entry
 * posted against a renamed account reads as the wrong account.
 *
 * `amount` is signed, per `Posting` in `@hewa/ledger-accounting`. A posting is not
 * a debit or a credit — it is a magnitude and a side, and `positive`/`negative`
 * means that, not "money in" and "money out".
 */
export interface LedgerPosting {
  readonly accountId: string;
  readonly accountName: string;
  readonly amount: Money;
}

/**
 * A journal entry, as a row.
 *
 * `balanced` is carried rather than implied, because the service refuses to post an
 * unbalanced entry and this row is also how a reader sees that it did: `debits` and
 * `credits` are the two totals, they are the numbers a reader adds up, and
 * `balanced` is the answer the database's own constraint gave. A row that could only
 * be balanced — because the service had refused everything else — would be an entry
 * list where the one thing worth checking is the one thing not shown.
 *
 * The postings themselves are not a separate section. They are a property of the
 * account the operator is looking at, and the ledger section's right column draws
 * them, which is where "what moved this account" belongs.
 */
export interface LedgerEntryRecord {
  readonly id: string;
  readonly reference: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly currency: Currency;
  readonly debits: Money;
  readonly credits: Money;
  readonly balanced: boolean;
  readonly postings: readonly LedgerPosting[];
}

/**
 * What `ledger/ledger` answers with: the chart, and the entries that moved it.
 *
 * Both halves, in one payload rather than as two sections, because the second is only
 * meaningful against the first — a posting is "what moved this account" and that
 * question names an account. A separate `ledger/entries` section would be a journal
 * browsable without the chart it is posted against, which is the one thing a journal
 * cannot be read without.
 *
 * `LedgerSectionRows["ledger/ledger"]` stays `LedgerAccount`: the rows a panel lists are
 * accounts, and the entries are a projection of one of them rather than rows of their
 * own. That is the same distinction the view draws — a table of accounts beside a
 * per-account list of movements.
 */
export interface LedgerSection {
  readonly accounts: readonly LedgerAccount[];
  readonly entries: readonly LedgerEntryRecord[];
}
