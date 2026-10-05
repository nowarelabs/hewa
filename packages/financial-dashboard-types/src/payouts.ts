import type { Currency, Money } from "@hewa/marketplace-types";
import { PAYOUT_STATUSES, PAYOUT_STATUS_TITLES, type PayoutStatus } from "@hewa/settlement-domain";

/**
 * Payouts: money leaving the marketplace, and what state each obligation is in.
 *
 * ## The status vocabulary is not restated here
 *
 * `PayoutStatus` is `@hewa/settlement-domain`'s, and the status column in the
 * database is generated from its `PAYOUT_STATUSES`. A dashboard that defined its own
 * `PayoutState` would be a second answer to "what states can a payout be in", and
 * the second answer is the one that lets a panel offer a transition
 * `assertPayoutTransition` refuses — an operator presses "mark completed" on a
 * payout still converting, the write is rejected by a rule they cannot see, and the
 * screen has told them something the domain never did.
 *
 * So the panel filters on these states and the write route accepts exactly the
 * transitions `canTransitionPayout` allows. One machine, read in two places.
 */
export { PAYOUT_STATUSES, PAYOUT_STATUS_TITLES };
export type { PayoutStatus };

/** How the money is actually delivered. */
export const PAYOUT_METHODS = ["bank", "usdc"] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * How each method is written where a human reads it.
 *
 * `usdc` reads "USDC wallet" and `bank` reads "Bank transfer", because those are
 * the two rails an operator is choosing between and "Bank" is ambiguous with an
 * obligation that has not left yet.
 */
export const PAYOUT_METHOD_TITLES: Readonly<Record<PayoutMethod, string>> = {
  bank: "Bank transfer",
  usdc: "USDC wallet",
};

/**
 * One payout obligation, as a row.
 *
 * `reference` is the correlation id tying the payout back to the bill it settles,
 * and it is the column that makes this table joinable to `finance_bills` at all:
 * `settlements.batch` is the clearing run, `finance_payouts.reference` is the bill.
 * A payout row without it could be aggregated but never reconciled, which is the
 * question a settlement figure is asked.
 */
export interface PayoutRecord {
  readonly id: string;
  readonly ispId: string;
  readonly ispName: string;
  readonly currency: Currency;
  /**
   * What is owed, and **positive**.
   *
   * The sign belongs to the movement that discharges the obligation, not to the
   * obligation: `settlements.amount_minor` is negative for a payout because it
   * records value that left, and this is positive because "we owe Karura $4,200" is
   * a positive fact. `PayoutObligation.amount` in `@hewa/settlement-domain` is
   * positive for the same reason, so a row and the object it models cannot disagree
   * about their sign — and `finance_payouts_amount_gt_zero` refuses the other
   * convention at the database rather than leaving it to a reader to negate.
   */
  readonly amount: Money;
  /** What it cost to send. Never negative. */
  readonly fee: Money;
  readonly status: PayoutStatus;
  readonly method: PayoutMethod;
  /** Correlation id tying the payout to the bill it settles. */
  readonly reference: string;
  readonly occurredAt: string;
  /** `null` when it did not fail, which is not the same as a failure nobody explained. */
  readonly failureReason: string | null;
}
