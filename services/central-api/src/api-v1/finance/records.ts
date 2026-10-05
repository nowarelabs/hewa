import type {
  AttestationRecord,
  AttestationVerdict,
  Bill,
  BillStatus,
  CreditBasis,
  CreditRecord,
  LedgerAccount,
  LedgerEntryRecord,
  LedgerPosting,
  PayoutMethod,
  PayoutRecord,
  PayoutStatus,
} from "@hewa/financial-dashboard-types";
import {
  account,
  balancesFrom,
  totalsFor,
  type Account,
  type AccountType,
  type JournalEntry,
  type Posting,
} from "@hewa/ledger-accounting";
import {
  addMoney,
  money,
  negateMoney,
  subtractMoney,
  zero,
  type Currency,
  type Money,
} from "@hewa/marketplace-types";

import { instant } from "../../db/instant.js";
import type {
  FinanceBillRow,
  FinanceLedgerAccountRow,
  FinanceLedgerEntryRow,
  FinanceLedgerPostingRow,
  FinancePayoutRow,
} from "../../db/schema.js";

/**
 * Row → record, for the six finance sections.
 *
 * Kept here rather than beside the console's mappers in `../data/records.js` because
 * this is the only place the two schemas' columns meet this dashboard's fields, and
 * that is a seam worth one file of its own: adding a column to `finance_bills` is a
 * change in `schema.ts` and in this file, and nowhere else.
 *
 * Every mapper that produces a `Money` or an instant goes through
 * `@hewa/marketplace-types` or `../../db/instant.js`, so the two driver differences
 * the rest of the workspace has learned about — minor units are integers, and PGlite
 * hands back a string where node-postgres hands back a `Date` — are handled once.
 */

/**
 * A bill.
 *
 * ## The breakdown is rebuilt, not read
 *
 * `finance_bills` holds three charge columns and no total, and this is why: the total
 * is a sum, and a stored total is a second copy of it. `BillBreakdown` from
 * `@hewa/billing-domain` is the shape that sum is typed into, so the figure the panel
 * prints is the figure that package would produce from the same three parts — and a
 * fourth charge added to the schema has to be added to the sum here or the build
 * fails on a missing field, rather than being quietly left out of a total.
 *
 * `slaCredit` stays negative on the way out, which is what `MonthlyBill` documents: a
 * credit reduces the total, so it is added and not subtracted, and a reader who wants
 * it as a positive allowance negates it deliberately rather than by accident.
 */
export function billRecord(row: FinanceBillRow): Bill {
  const currency = row.currency as Currency;
  return {
    id: row.id,
    ispId: row.ispId,
    ispName: row.ispName,
    month: row.month,
    currency,
    committedMbps: row.committedMbps,
    breakdown: {
      commitmentCharge: money(row.commitmentChargeMinor, currency),
      overageCharge: money(row.overageChargeMinor, currency),
      slaCredit: money(row.slaCreditMinor, currency),
      netTotal: money(
        row.commitmentChargeMinor + row.overageChargeMinor + row.slaCreditMinor,
        currency,
      ),
    },
    status: row.status as BillStatus,
    dueAt: instant(row.dueAt),
    disputeReason: row.disputeReason,
    issuedAt: instant(row.issuedAt),
  };
}

/**
 * A payout obligation.
 *
 * `amount` is passed through untouched, because it is positive on the row and
 * positive in `PayoutObligation` and in this contract. Negating it here would make
 * the sign a fact about which mapper a number went through.
 */
export function payoutRecord(row: FinancePayoutRow): PayoutRecord {
  const currency = row.currency as Currency;
  return {
    id: row.id,
    ispId: row.ispId,
    ispName: row.ispName,
    currency,
    amount: money(row.amountMinor, currency),
    fee: money(row.feeMinor, currency),
    status: row.status as PayoutStatus,
    method: row.method as PayoutMethod,
    reference: row.reference,
    occurredAt: instant(row.occurredAt),
    failureReason: row.failureReason,
  };
}

/**
 * A credit, with the bill's own columns joined on.
 *
 * `finance_credits` holds no `ispId`, `month` or `currency` — they are the bill's, and
 * a credit that carried its own copy could name one ISP while pointing at another's
 * bill. So this takes the joined row rather than the credit row, and the service's
 * query is a `join` rather than a `select`, which is the reason this is not a
 * one-argument mapper.
 *
 * `amount` is negative, as the column check says it must be: a credit of $1,200 is
 * `-120_000`, and the panel shows it as an allowance by negating it in the one place
 * that formats money.
 */
export function creditRecord(row: FinanceBillRow & FinanceCreditColumns): CreditRecord {
  const currency = row.currency as Currency;
  return {
    id: row.id,
    billId: row.billId,
    ispId: row.ispId,
    ispName: row.ispName,
    month: row.month,
    currency,
    amount: money(row.amountMinor, currency),
    basis: row.basis as CreditBasis,
    note: row.note,
    recordedAt: instant(row.recordedAt),
  };
}

/** The credit half of a joined credit row, named so the mapper's argument reads. */
export interface FinanceCreditColumns {
  readonly billId: string;
  readonly amountMinor: number;
  readonly basis: string;
  readonly note: string;
  readonly recordedAt: Date;
}

/**
 * An attestation.
 *
 * `netRevenue` is `gross - costs`, computed here. It is not on the row and it is not
 * a `bigint`: it is a subtraction of two integers that already exist, and doing it in
 * the mapper means the books, the panel and any future export all read one figure.
 *
 * `verdict` is a placeholder that `attestationsWithVerdicts` replaces, because a
 * verdict is a property of the **month** and no single row knows how many days its
 * month has. It is spelled `partial` rather than `undefined` so that the field is
 * total in the type: a record whose verdict was merely unset would render as a row
 * with no verdict and read as "coverage unknown", which is a third thing.
 */
export function attestationRecord(row: FinanceAttestationColumns): AttestationRecord {
  const currency = row.currency as Currency;
  const gross = money(row.grossMinor, currency);
  const costs = money(row.costsMinor, currency);
  return {
    id: row.id,
    city: row.city,
    month: row.month,
    day: row.day,
    currency,
    gross,
    costs,
    netRevenue: subtractMoney(gross, costs),
    publishedAt: instant(row.publishedAt),
    verdict: "partial",
  };
}

/** One attestation row, by its columns rather than by its table. */
export interface FinanceAttestationColumns {
  readonly id: string;
  readonly city: string;
  readonly month: string;
  readonly day: number;
  readonly currency: string;
  readonly grossMinor: number;
  readonly costsMinor: number;
  readonly publishedAt: Date;
}

/**
 * The chart, as `Account` objects.
 *
 * So that `normalSide` comes from the domain rather than from a table written here.
 * `account()` throws a `ValidationError` on an unknown type and returns the normal
 * side for a known one, and that mapping — asset and expense debit, the rest credit —
 * is the one place in this workspace that may say which sign an account's balance
 * takes. A second table beside it would be the copy that eventually disagrees, and it
 * would disagree in a way that still foots: a trial balance sums to zero with the
 * signs wrong.
 */
export function accountRecords(rows: readonly FinanceLedgerAccountRow[]): Account[] {
  return rows.map((row) =>
    account(row.id, row.name, row.type as AccountType, row.currency as Currency),
  );
}

/**
 * Entry rows and their legs, as `JournalEntry` objects.
 *
 * ## Why this is a join and not a nested read
 *
 * Because that is how the table is written: legs are rows, so a caller that wants an
 * entry with its postings has to put them back together, and this is the one place
 * that does. Grouping by `entryId` here rather than in SQL keeps the rule in one
 * function, and the service can hand it the two lists without assembling a join
 * shape first.
 *
 * ## Why a leg for an unknown account throws rather than defaults
 *
 * Because `balancesFrom` throws for exactly that case, and if this function invented
 * a zero-amount posting for a missing leg the error would surface as a trial balance
 * that is quietly wrong rather than as a refusal. `currencyOf` is therefore required
 * to throw — the service passes a lookup that reads the chart, and a leg naming an
 * account outside the chart fails there.
 *
 * The postings are built with `posting(...)` rather than as object literals so that
 * the `Posting` shape has one constructor, and `entry.occurredAt` goes through
 * `instant` because a `Date` from the driver and a string from PGlite are both a
 * `Date | string` at this boundary.
 */
export function journalEntries(
  entryRows: readonly FinanceLedgerEntryRow[],
  legRows: readonly FinanceLedgerPostingRow[],
  currencyOf: (accountId: string) => Currency,
): JournalEntry[] {
  const legsByEntry = new Map<string, Posting[]>();
  for (const leg of legRows) {
    const leg_ = {
      accountId: leg.accountId,
      amount: money(leg.amountMinor, currencyOf(leg.accountId)),
    };
    const existing = legsByEntry.get(leg.entryId);
    if (existing === undefined) {
      legsByEntry.set(leg.entryId, [leg_]);
    } else {
      existing.push(leg_);
    }
  }

  return entryRows.map((entry) => ({
    id: entry.id,
    reference: entry.reference,
    description: entry.description,
    occurredAt: instant(entry.occurredAt),
    postings: legsByEntry.get(entry.id) ?? [],
  }));
}

/**
 * Chart rows with their balances, for `ledger/ledger`.
 *
 * ## The balance is the domain's, not this file's
 *
 * `balancesFrom` folds entries into a balance per account **on the account's normal
 * side**, using the same `Account` objects this file built, so an account's balance
 * arrives positive when it is positive. Recomputing it here would mean reading
 * `normalSide` correctly twice, and the second copy is the one that would be wrong.
 *
 * `balancesFrom` returns only accounts that were touched, so an untouched account is
 * absent from the map and gets an explicit zero below — which is a different fact
 * from "no balance", and the panel needs the first one.
 */
export function ledgerAccountRecords(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): LedgerAccount[] {
  const balanceByAccount = new Map(
    balancesFrom(accounts, entries).map((row) => [row.accountId, row.balance]),
  );
  const debits = new Map<string, Money>();
  const credits = new Map<string, Money>();

  // Per-account debit and credit totals, which `totalsFor` does not do: it is per
  // entry, and no function in `@hewa/ledger-accounting` folds to a per-account pair.
  //
  // The rule is `totalsFor`'s, unchanged, and the account's normal side is nowhere
  // in it: a positive posting is a debit and a negative one is a credit, whichever
  // account it lands on. That is worth spelling out, because the obvious
  // alternative — "which side of *this* account did it land on" — is wrong, and
  // wrong in a way these columns look entirely reasonable under. A revenue account's
  // postings are all negative, so the alternative files every accrual under its
  // **debit** column and then reports revenue that grew by being debited, which is a
  // number a reader has no reason to doubt until it disagrees with the bank.
  //
  // The normal side is not ignored, it is applied exactly once: `balancesFrom` flips
  // the raw sum for the balance. Applying it a second time here, to the columns, is
  // the same rule in the wrong place — and the result is a `balance` that disagrees
  // with the two totals printed beside it.
  for (const entry of entries) {
    for (const leg of entry.postings) {
      const magnitude = leg.amount.amountMinor < 0 ? negateMoney(leg.amount) : leg.amount;
      const target = leg.amount.amountMinor < 0 ? credits : debits;
      target.set(
        leg.accountId,
        addMoney(target.get(leg.accountId) ?? zero(leg.amount.currency), magnitude),
      );
    }
  }

  return accounts.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    normalSide: row.normalSide,
    debit: debits.get(row.id) ?? zero(row.currency),
    credit: credits.get(row.id) ?? zero(row.currency),
    balance: balanceByAccount.get(row.id) ?? zero(row.currency),
  }));
}

/**
 * One journal entry with its legs, resolved to the names a reader sees.
 *
 * `debits`, `credits` and `balanced` all come from one `totalsFor` call, so the
 * balanced flag is a comparison of the two totals printed beside it and cannot be a
 * third opinion. `accountName` falls back to the id rather than to an empty string,
 * because a posting naming an account not in the chart is a real defect and it should
 * be legible in the panel rather than invisible.
 *
 * The entry's `currency` is used for the totals, so an entry whose legs are in another
 * currency totals to zero on both sides and reads as balanced. That is not a silent
 * pass: `totalsFor` skips other currencies rather than converting, and the write path
 * is what refuses a mixed-currency entry — see the `ledger_entries` create service.
 */
export function ledgerEntryRecord(
  entry: JournalEntry,
  nameByAccount: ReadonlyMap<string, string>,
  currency: Currency,
): LedgerEntryRecord {
  const totals = totalsFor(entry, currency);
  const postings: LedgerPosting[] = entry.postings.map((leg) => ({
    accountId: leg.accountId,
    accountName: nameByAccount.get(leg.accountId) ?? leg.accountId,
    amount: leg.amount,
  }));

  return {
    id: entry.id,
    reference: entry.reference,
    description: entry.description,
    occurredAt: entry.occurredAt,
    currency,
    debits: totals.debits,
    credits: totals.credits,
    balanced: totals.debits.amountMinor === totals.credits.amountMinor,
    postings,
  };
}

/**
 * The journal, for the ledger section's right column.
 *
 * `entryRows` is passed beside `entries` rather than reading a currency off an entry,
 * because `JournalEntry` has no currency of its own — its postings carry one each, and
 * an entry whose legs disagree about it is refused on the way in rather than here. So
 * the currency is the entry **row's** own column, looked up by id rather than by index:
 * `journalEntries` maps its rows in order, and pairing two lists by position is a
 * coupling that a change to either one's ordering would break silently.
 *
 * A row missing from the map throws. Every entry row is read by `journalEntries` from
 * the same list this is called with, so an id here that is not in `entries` would mean
 * the two lists were built from different rows, and answering with a guessed currency
 * would be a balanced flag computed against the wrong unit.
 */
export function ledgerEntryRecords(
  entries: readonly JournalEntry[],
  entryRows: readonly FinanceLedgerEntryRow[],
  nameByAccount: ReadonlyMap<string, string>,
): LedgerEntryRecord[] {
  const currencyByEntry = new Map(entryRows.map((row) => [row.id, row.currency]));

  return entries.map((entry) => {
    const currency = currencyByEntry.get(entry.id);

    if (currency === undefined) {
      throw new Error(`Journal entry has no row to read its currency from: ${entry.id}`);
    }

    return ledgerEntryRecord(entry, nameByAccount, currency);
  });
}

/**
 * The verdict of each **city's** month, from how many of its days are published.
 *
 * `complete` when the count reaches the number of days the month has, `partial`
 * otherwise. Two passes — count, then decide — so a city-month is judged once rather
 * than once per day.
 *
 * ## Why the grouping is `(city, month)` and not `month`
 *
 * Because a month holds one row per city per day, and the question an operator asks
 * of a shortfall is "which city is missing days". Judging the month as a whole would
 * report January complete because Nairobi published 31 days while Mombasa published
 * 19: the month *is* complete for one of its three cities and short for two, and a
 * single verdict would have to lie about either the one or the two. A chip that said
 * "complete" over a column with twelve Mombasa days missing is a chip that was pressed
 * and hid something.
 *
 * It also makes `partial` reachable at all. With one verdict per month, the value only
 * appeared while a month was still filling in, and after that no row could ever be
 * `partial` — a vocabulary member that is a transient state of the data rather than a
 * fact about a customer.
 *
 * `daysInMonth` is computed rather than stored: a month has 28, 29, 30 or 31 days,
 * and a stored length is a fourth thing to get right about a date. `Date.UTC` with a
 * month index past the end of a month rolls into the next one, so day zero of the
 * following month is this month's last day — which is how February is right without a
 * table of lengths.
 *
 * ## And why the answer is never `none`
 *
 * A city with no published days contributes no rows, so it is absent from `published`
 * entirely and there is nothing to put a verdict on. The vocabulary holds `complete`
 * and `partial` for that reason, and a reader who wants to know about an empty city
 * asks the section for a city that has none.
 */
export function attestationsWithVerdicts(rows: readonly AttestationRecord[]): AttestationRecord[] {
  // A nested map rather than one key of `"city month"` joined with a separator, which
  // is the version that works until a city has a space in its name. `indexOf` then
  // finds the wrong one and `daysInMonth` is handed `"es Salaam 2026-01"` — a 500 on
  // the section, for a fixture that looks like three whole cities.
  const publishedByMonth = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const byCity = publishedByMonth.get(row.month) ?? new Map<string, number>();
    byCity.set(row.city, (byCity.get(row.city) ?? 0) + 1);
    publishedByMonth.set(row.month, byCity);
  }

  const verdictByCity = new Map<string, Map<string, AttestationVerdict>>();
  for (const [month, byCity] of publishedByMonth) {
    const verdicts = new Map<string, AttestationVerdict>();
    for (const [city, count] of byCity) {
      verdicts.set(city, verdictFor(count, month));
    }
    verdictByCity.set(month, verdicts);
  }

  return rows.map((row) => ({
    ...row,
    verdict: verdictByCity.get(row.month)?.get(row.city) ?? "partial",
  }));
}

/**
 * A city-month's verdict, from how many of its days are published.
 *
 * ## Why this is its own function
 *
 * Because a verdict is not a property of one row, and there are two callers that
 * need one: this file, folding a whole section, and `attestations.write.service.ts`,
 * answering for the single row it just wrote. The second caller is not optional — a
 * `POST` to `/api/v1/data/attestations` returns an `AttestationRecord`, and a record
 * whose `verdict` is missing is a row the panel cannot colour. So the rule lives here
 * and is *counted* into by both: the section counts every city-month it holds, and
 * the write service counts the one it is about to answer for. Inlined into the fold,
 * the rule would be two copies that agree until a month gains a leap-day rule.
 *
 * `publishedDays >= daysInMonth(month)` rather than `===`: a caller counting a
 * section that has already been told about a duplicate row should still get
 * `complete`, and the count can only exceed the month through a bug elsewhere —
 * failing that bug by saying "complete" is better than calling a finished month
 * partial.
 */
export function verdictFor(publishedDays: number, month: string): AttestationVerdict {
  return publishedDays >= daysInMonth(month) ? "complete" : "partial";
}

/**
 * How many days a `YYYY-MM` month has.
 *
 * `Date.UTC(year, month, 0)` is the last day of `month`, because a day index of zero
 * is the day before the first: `month` here is 1-based out of `split`, and
 * `Date.UTC` takes it 0-based, so passing it through unchanged lands on the last day
 * of that 1-based month. The `Number.isNaN` guard is the `YYYY-MM` format check the
 * schema's check constraint also makes, and it is here because a mapper must not
 * throw `RangeError` out of `Date.UTC` on a value it was handed.
 */
export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  if (
    year === undefined ||
    monthNumber === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(monthNumber)
  ) {
    throw new Error(`Not a YYYY-MM month: ${month}`);
  }
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}
