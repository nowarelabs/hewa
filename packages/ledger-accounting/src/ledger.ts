import { ValidationError } from "@hewa/errors";
import { addMoney, zero, type Currency, type Money } from "@hewa/marketplace-types";

/**
 * The account types a marketplace ledger needs.
 *
 * The set is deliberately small. Every extra type is a rule somebody has to
 * enforce, and a chart of accounts nobody can hold in their head is how books
 * stop being auditable.
 */
export const ACCOUNT_TYPES = ["asset", "liability", "revenue", "expense", "equity"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

const ACCOUNT_TYPE_SET: ReadonlySet<string> = new Set(ACCOUNT_TYPES);

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && ACCOUNT_TYPE_SET.has(value);
}

/** An account in the chart. */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  /** Normal balance side, e.g. `debit` for an asset. */
  readonly normalSide: "debit" | "credit";
}

const NORMAL_SIDE: Readonly<Record<AccountType, "debit" | "credit">> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  revenue: "credit",
  equity: "credit",
};

export function account(id: string, name: string, type: AccountType, currency: Currency): Account {
  if (!isAccountType(type)) {
    throw new ValidationError("Unsupported account type", {
      id,
      received: String(type),
      supported: [...ACCOUNT_TYPES],
    });
  }
  return { id, name, type, currency, normalSide: NORMAL_SIDE[type] };
}

/** One side of a journal entry. */
export interface Posting {
  readonly accountId: string;
  /** Signed amount in the account's currency. Negative means the other side. */
  readonly amount: Money;
}

export function posting(accountId: string, amount: Money): Posting {
  return { accountId, amount };
}

/**
 * A balanced set of postings.
 *
 * An entry that does not balance is not posted. The constructor is the only
 * place that can enforce it, so nothing downstream has to re-check.
 */
export interface JournalEntry {
  readonly id: string;
  readonly reference: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly postings: readonly Posting[];
}

export function journalEntry(
  id: string,
  reference: string,
  occurredAt: string,
  description: string,
  postings: readonly Posting[],
): JournalEntry {
  assertBalanced(postings, id);
  return { id, reference, occurredAt, description, postings };
}

/**
 * Check that debits equal credits.
 *
 * This is the invariant the entire package exists to protect. It is checked
 * once, on construction, rather than trusted afterwards.
 */
export function assertBalanced(postings: readonly Posting[], entryId = "unknown"): void {
  if (postings.length < 2) {
    throw new ValidationError("A journal entry needs at least two postings", {
      entryId,
      postings: postings.length,
    });
  }
  const totals = totalsByCurrency(postings);
  for (const [currency, total] of totals) {
    if (total.amountMinor !== 0) {
      throw new ValidationError("Journal entry does not balance", {
        entryId,
        currency,
        differenceMinor: total.amountMinor,
      });
    }
  }
}

function totalsByCurrency(postings: readonly Posting[]): Map<Currency, Money> {
  const totals = new Map<Currency, Money>();
  for (const line of postings) {
    const current = totals.get(line.amount.currency) ?? zero(line.amount.currency);
    totals.set(line.amount.currency, addMoney(current, line.amount));
  }
  return totals;
}

/** Debit and credit totals for one currency, for review screens. */
export interface EntryTotals {
  readonly currency: Currency;
  readonly debits: Money;
  readonly credits: Money;
}

export function totalsFor(entry: JournalEntry, currency: Currency): EntryTotals {
  let debits = zero(currency);
  let credits = zero(currency);
  for (const line of entry.postings) {
    if (line.amount.currency !== currency) continue;
    if (line.amount.amountMinor < 0) credits = addMoney(credits, negate(line.amount));
    else debits = addMoney(debits, line.amount);
  }
  return { currency, debits, credits };
}

/**
 * A posting, a single account's running balance.
 *
 * Expressed on the account's own normal side, so revenue earned reads as a
 * positive number and a liability reads positive when it is owed. A raw
 * debit-positive sum is available through {@link rawBalancesFrom} for the
 * places that genuinely need the signed view.
 */
export interface AccountBalance {
  readonly accountId: string;
  readonly balance: Money;
}

/** Index the chart by id, failing loudly on a duplicate. */
export function indexAccounts(accounts: readonly Account[]): Map<string, Account> {
  const byId = new Map<string, Account>();
  for (const account of accounts) {
    if (byId.has(account.id)) {
      throw new ValidationError("Duplicate account in the chart", { id: account.id });
    }
    byId.set(account.id, account);
  }
  return byId;
}

/**
 * Fold a set of entries into a balance per account, on the normal side.
 *
 * Only accounts that were actually touched appear, so a caller can distinguish
 * "zero" from "never seen". Posting to an account outside the chart is an
 * error: it would produce a balance with no known sign convention.
 */
export function balancesFrom(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): AccountBalance[] {
  const byId = indexAccounts(accounts);
  const sums = new Map<string, Money>();

  for (const entry of entries) {
    for (const line of entry.postings) {
      const account = byId.get(line.accountId);
      if (account === undefined) {
        throw new ValidationError("Posting references an account outside the chart", {
          entryId: entry.id,
          accountId: line.accountId,
        });
      }
      if (account.currency !== line.amount.currency) {
        throw new ValidationError("Posting currency does not match the account", {
          entryId: entry.id,
          accountId: line.accountId,
          expected: account.currency,
          received: line.amount.currency,
        });
      }
      const current = sums.get(line.accountId) ?? zero(account.currency);
      sums.set(line.accountId, addMoney(current, line.amount));
    }
  }

  return [...sums.entries()].map(([accountId, raw]) => {
    const account = byId.get(accountId);
    // indexAccounts guarantees the lookup, and the loop above already threw
    // for a miss, so this cannot be undefined in practice.
    if (account === undefined) {
      throw new ValidationError("Posting references an account outside the chart", {
        accountId,
      });
    }
    return {
      accountId,
      balance:
        account.normalSide === "credit"
          ? { amountMinor: -raw.amountMinor, currency: raw.currency }
          : raw,
    };
  });
}

/** The same fold, left as a raw signed sum with debits positive. */
export function rawBalancesFrom(entries: readonly JournalEntry[]): AccountBalance[] {
  const sums = new Map<string, Money>();
  for (const entry of entries) {
    for (const line of entry.postings) {
      const current = sums.get(line.accountId) ?? zero(line.amount.currency);
      sums.set(line.accountId, addMoney(current, line.amount));
    }
  }
  return [...sums.entries()].map(([accountId, balance]) => ({ accountId, balance }));
}

/**
 * Debit and credit totals across a set of entries.
 *
 * The zero check belongs here and not on the normal-side balances: a revenue
 * account's balance is positive precisely because it was credited, so summing
 * normal-side balances proves nothing. What must hold is that the books debit
 * exactly as much as they credit.
 */
export interface TrialBalance {
  readonly currency: Currency;
  readonly debits: Money;
  readonly credits: Money;
  readonly balanced: boolean;
}

export function trialBalance(entries: readonly JournalEntry[], currency: Currency): TrialBalance {
  let debits = zero(currency);
  let credits = zero(currency);
  for (const entry of entries) {
    for (const line of entry.postings) {
      if (line.amount.currency !== currency) continue;
      if (line.amount.amountMinor < 0) credits = addMoney(credits, negate(line.amount));
      else debits = addMoney(debits, line.amount);
    }
  }
  return { currency, debits, credits, balanced: debits.amountMinor === credits.amountMinor };
}

/** Throw unless the books debit exactly as much as they credit. */
export function assertLedgerBalances(entries: readonly JournalEntry[], currency: Currency): void {
  const trial = trialBalance(entries, currency);
  if (!trial.balanced) {
    throw new ValidationError("Ledger does not balance", {
      currency,
      debitsMinor: trial.debits.amountMinor,
      creditsMinor: trial.credits.amountMinor,
    });
  }
}

/**
 * A pair of entries that always move together.
 *
 * Most marketplace movements are just one of these: a charge, a payout, a
 * credit. Naming them keeps the service code readable and keeps the signs in
 * one reviewed place.
 */
export interface EntryTemplate {
  readonly description: string;
  readonly postings: readonly Posting[];
}

export function chargeRevenue(
  entryId: string,
  reference: string,
  occurredAt: string,
  amount: Money,
  receivableAccountId: string,
  revenueAccountId: string,
): JournalEntry {
  return journalEntry(entryId, reference, occurredAt, "Charge for bandwidth delivered", [
    posting(receivableAccountId, amount),
    posting(revenueAccountId, negate(amount)),
  ]);
}

export function settleReceivable(
  entryId: string,
  reference: string,
  occurredAt: string,
  amount: Money,
  receivableAccountId: string,
  cashAccountId: string,
): JournalEntry {
  return journalEntry(entryId, reference, occurredAt, "Cash received against an ISP account", [
    posting(cashAccountId, amount),
    posting(receivableAccountId, negate(amount)),
  ]);
}

export function accrueSlaCredit(
  entryId: string,
  reference: string,
  occurredAt: string,
  credit: Money,
  receivableAccountId: string,
  revenueAccountId: string,
): JournalEntry {
  // `credit` arrives negative from the billing domain, so the receivable falls
  // and revenue falls with it.
  return journalEntry(entryId, reference, occurredAt, "SLA credit against a delivered month", [
    posting(receivableAccountId, credit),
    posting(revenueAccountId, negate(credit)),
  ]);
}

function negate(value: Money): Money {
  return { amountMinor: -value.amountMinor, currency: value.currency };
}
