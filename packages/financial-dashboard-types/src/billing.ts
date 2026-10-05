import type { BillBreakdown } from "@hewa/billing-domain";
import type { Currency, Money } from "@hewa/marketplace-types";

/**
 * Revenue: the bills issued, what is still owed on them, and the credits that have
 * been taken off.
 *
 * ## Why amounts are `Money` and not `number`
 *
 * Every amount in this file is a {@link Money} rather than a bare `amountMinor: number`,
 * and that is not decoration. These figures are summed, compared for equality, and
 * written to a ledger that has to balance, and a plain number cannot tell a reader
 * which currency's minor units they are looking at or how many decimals it has.
 * A `total` of `450000` beside a `currency` of `KES` is a figure nobody can price
 * from, because 450,000 Kenyan cents and 450,000 US cents differ by two orders of
 * magnitude and the row does not say which it is.
 *
 * The one place a bare number appears is a write payload, and `writes.ts` says why
 * there: a write is columns, and a row has one `currency` column that must not be
 * contradicted by a second one hiding inside an amount object.
 */

/**
 * Where a bill is in its own lifecycle.
 *
 * The vocabulary an operator filters bills by, and it is a vocabulary rather than a
 * derived count: `disputed` is the state this dashboard exists to make visible, and
 * a chip for it has to be there on a month with no disputes rather than appearing
 * the moment somebody argues about a bill.
 */
export const BILL_STATUSES = ["draft", "issued", "disputed", "paid", "void"] as const;

export type BillStatus = (typeof BILL_STATUSES)[number];

/**
 * How each status is written where a human reads it.
 *
 * Keyed by the **value** a row carries, so a panel's chip reads "Disputed" while
 * the query string says `disputed`. Built from the member name it would read
 * `Billstatus.Disputed` for one of the five and be right for the rest by accident.
 *
 * A `Record<BillStatus, string>` rather than a partial one, so a status added to
 * `BILL_STATUSES` without a title is a compile error here and not an `undefined`
 * in a chip.
 */
export const BILL_STATUS_TITLES: Readonly<Record<BillStatus, string>> = {
  draft: "Draft",
  issued: "Issued",
  disputed: "Disputed",
  paid: "Paid",
  void: "Void",
};

/**
 * The moves a bill may make, and only those.
 *
 * ## Why this lives in the contract rather than in the service
 *
 * Because two sides need the same table and only one of them may own it. The service
 * needs it to refuse an illegal `PATCH`, and the editor needs it to decide which
 * statuses to *offer* — an editor that listed all five would show a reader a choice
 * the service answers with a 422, which is a control that lies. Duplicated, the two
 * would agree until a status was added to one, and then the dashboard would offer a
 * move that cannot be made.
 *
 * It is a `Record` of every status rather than a list of pairs, so a status added to
 * `BILL_STATUSES` without a row here fails the build. A list of pairs would grow a
 * status with no moves and answer `canTransitionBill(newStatus, anything)` as `false`,
 * which is a bill nobody can issue.
 *
 * ## Why each of these
 *
 * - `draft` → `issued` or `void`. A draft that is not going out is withdrawn.
 * - `issued` → `disputed`, `paid` or `void`. The three things that can happen to an
 *   invoice: it is argued about, it is settled, or it is withdrawn.
 * - `disputed` → `issued` or `void`, and `disputed` → `paid`. The dispute is either
 *   resolved in the ISP's favour and the bill stands, or withdrawn, or settled. A
 *   dispute cannot be resolved *by* going back to `disputed`, and it cannot jump
 *   straight back to `draft` — that would re-open an invoice an operator had already
 *   finished with, and a second billing run for the month would produce a second
 *   number for the same service.
 * - `paid` and `void` → nothing. Both are terminal: money came in, or the invoice was
 *   withdrawn. A `paid` bill that can be un-paid is a bill whose ageing can be
 *   rewritten, and the receivables figure is exactly that number.
 */
export const BILL_TRANSITIONS: Readonly<Record<BillStatus, readonly BillStatus[]>> = {
  draft: ["issued", "void"],
  issued: ["disputed", "paid", "void"],
  disputed: ["issued", "void", "paid"],
  paid: [],
  void: [],
};

/**
 * Whether a bill may move from one status to another.
 *
 * `canTransitionBill(from, to)` rather than an assertion, because the editor asks the
 * question to decide what to draw and the service asks it to decide what to refuse.
 * Both are the same question and the answer belongs to one function.
 */
export function canTransitionBill(from: BillStatus, to: BillStatus): boolean {
  return BILL_TRANSITIONS[from].includes(to);
}

/**
 * A monthly bill, as a row.
 *
 * The three charges stay separate in `breakdown` rather than collapsing into a
 * total, because a disputed bill is argued line by line and a single number cannot
 * be defended. `BillBreakdown` is `@hewa/billing-domain`'s own shape for exactly
 * that trio, reused rather than restated — a dashboard that re-spelled it would be a
 * second definition of what a bill is made of, and the invoice and the screen would
 * eventually disagree about the overage charge.
 *
 * `ispName` is carried beside `ispId` for the same reason `finance_credits` carries
 * it: the name is what the operator reads, and joining it at draw time means a bill
 * whose customer has since been renamed reads as the wrong customer.
 */
export interface Bill {
  readonly id: string;
  readonly ispId: string;
  readonly ispName: string;
  /** Billing month as `YYYY-MM`. */
  readonly month: string;
  readonly currency: Currency;
  /** The committed capacity the month is billed on. */
  readonly committedMbps: number;
  /** Commitment charge, overage charge, SLA credit and net total. */
  readonly breakdown: BillBreakdown;
  readonly status: BillStatus;
  /** RFC 3339. When the bill stops being payable. */
  readonly dueAt: string;
  /**
   * Why this bill is disputed, or `null`.
   *
   * Absent rather than an empty string, and the database refuses a `disputed` bill
   * with no reason: a dispute nobody can state is not a dispute, it is a bill
   * somebody has not understood yet.
   */
  readonly disputeReason: string | null;
  /** RFC 3339. When the bill was issued. */
  readonly issuedAt: string;
}

/**
 * How long a receivable has been unpaid.
 *
 * Ageing buckets rather than a day count as the group vocabulary, because "how much
 * is 60 to 90 days late" is the question a collections view exists to answer and
 * "how many days late is this specific bill" is a column on the row. The bucket is
 * also fixed rather than derived, so the chip for the worst bucket is present on a
 * month where nothing is late.
 */
export const RECEIVABLE_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;

export type ReceivableBucket = (typeof RECEIVABLE_BUCKETS)[number];

/**
 * How each ageing bucket is written where a human reads it.
 *
 * `d1_30` reads as "1–30 days", because the wire value cannot: an en dash in a
 * query string is a percent-encoded character an operator has to guess at, and
 * `d90_plus` reads as "90+ days" because "90 plus days overdue" is a phrase
 * nobody says.
 */
export const RECEIVABLE_BUCKET_TITLES: Readonly<Record<ReceivableBucket, string>> = {
  current: "Current",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "90+ days",
};

/**
 * One bill's outstanding balance.
 *
 * Not a stored figure. `outstanding` is what `@hewa/billing-domain`'s
 * `outstandingBalance` returns for this bill's net total and what has been settled
 * against it, so the dashboard's number and the invoice's number come from one
 * subtraction. A column that stored it would be a second copy of that rule, and a
 * second copy is one that eventually disagrees by a rounding step.
 *
 * There is no table behind this section: a receivable is a bill that has not been
 * paid, and one row of bills is one row of receivables. Deriving it here is what
 * keeps the two views from disagreeing about the same money.
 */
export interface Receivable {
  readonly billId: string;
  readonly ispId: string;
  readonly ispName: string;
  readonly month: string;
  readonly currency: Currency;
  /** The bill's net total. */
  readonly total: Money;
  /** What has been paid against it. */
  readonly settled: Money;
  /** What is still owed. */
  readonly outstanding: Money;
  readonly dueAt: string;
  /** Negative before the due date, and so a floor rather than a clamp. */
  readonly daysOverdue: number;
  readonly bucket: ReceivableBucket;
}

/**
 * Why a credit was taken off a bill.
 *
 * The axis an operator filters credits by, and it is the reason a credit exists:
 * `sla_shortfall` is a promise that was missed and priced by
 * `@hewa/billing-domain`, while `dispute` and `goodwill` are decisions somebody
 * made. A credit list with no basis column is a list of negative numbers.
 */
export const CREDIT_BASES = ["sla_shortfall", "dispute", "goodwill"] as const;

export type CreditBasis = (typeof CREDIT_BASES)[number];

/**
 * How each basis is written where a human reads it.
 *
 * `sla_shortfall` reads "SLA shortfall" rather than "SLA_shortfall": the chip is a
 * label for a person, and the underscore is wire format. `goodwill` reads "Goodwill"
 * because the alternative — "Decided" — is a claim about who authorised it that the
 * row does not record.
 */
export const CREDIT_BASIS_TITLES: Readonly<Record<CreditBasis, string>> = {
  sla_shortfall: "SLA shortfall",
  dispute: "Dispute",
  goodwill: "Goodwill",
};

/**
 * A credit taken off a bill.
 *
 * `amount` is signed and never positive, which is the ledger's own convention and
 * `@hewa/billing-domain`'s: `MonthlyBill.slaCredit` is documented as "a negative
 * amount, or zero", so a credit row that carried a positive number would have to be
 * negated again by every reader, and one that forgot would raise a receivable
 * instead of clearing it. The database refuses a positive credit for the same
 * reason — a check constraint is the only place that sees every write.
 */
export interface CreditRecord {
  readonly id: string;
  readonly billId: string;
  readonly ispId: string;
  readonly ispName: string;
  readonly month: string;
  readonly currency: Currency;
  /** Signed and never positive. */
  readonly amount: Money;
  readonly basis: CreditBasis;
  /** What the credit was for. Free text, and required — a credit with no note is a mystery. */
  readonly note: string;
  readonly recordedAt: string;
}
