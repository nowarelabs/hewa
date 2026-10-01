/**
 * The `settlement` view: how value moves, and what stopped it moving.
 *
 * An ISP sells bandwidth, a buyer buys it, and somewhere between them the money
 * has to land in the right wallet with the right amount in it. This view is that
 * middle, and it is the only place in the console where a figure is a number
 * rather than a measurement.
 */
import type { Currency, Money, TransactionStatus } from "@hewa/marketplace-types";

/**
 * Why a line of value is moving at all.
 *
 * The four are the four things an operator is asked about, and they are asked in
 * that order: what cleared, what trickled, what is being held, and what went
 * out. `micro_payment` is the marketplace's own unit of account — the per-flow
 * charges that sum into an invoice — and it is a kind of its own rather than a
 * flag on a clearing line, because an operator watching one flow needs to filter
 * to it without losing the batch it belongs to.
 */
export type SettlementKind = "clearing" | "micro_payment" | "escrow" | "payout";

/**
 * Every {@link SettlementKind}, in the order the operator asks about them.
 *
 * A runtime list beside the union so a rail or a filter bar is built from the
 * vocabulary rather than from whatever the rows happen to hold, and typed
 * `readonly SettlementKind[]` so a kind added to the union is a compile error here
 * rather than a chip that sorts somewhere arbitrary.
 */
export const SETTLEMENT_KINDS: readonly SettlementKind[] = [
  "clearing",
  "micro_payment",
  "escrow",
  "payout",
];

/** How each kind is written in a rail label. */
export const SETTLEMENT_KIND_TITLES: Readonly<Record<SettlementKind, string>> = {
  clearing: "Clearing",
  micro_payment: "Micro payments",
  escrow: "Escrow",
  payout: "Payouts",
};

/** One movement of value, as this view sees it. */
export interface Settlement {
  readonly id: string;
  /** The run this line belongs to, so a batch can be read as a batch. */
  readonly batch: string;
  readonly kind: SettlementKind;
  readonly status: TransactionStatus;
  /** The provider or buyer on the other side of the movement. */
  readonly counterparty: string;
  /** The value moved, signed. A credit is negative, by the same convention the ledger uses. */
  readonly amount: Money;
  /** What the marketplace took. Never negative: a fee on a credit is a smaller fee. */
  readonly fee: Money;
  /** An ISO 8601 instant. */
  readonly occurredAt: string;
  /**
   * Why it did not move, or `null` when it did or has not been tried yet.
   *
   * A nullable sentence rather than a status that says "failed" and leaves the
   * operator to guess: a settlement run fails for a handful of named reasons and
   * each of them is somebody's action, so the reason is the field and the status
   * is the filter.
   */
  readonly failureReason: string | null;
}

/**
 * `settlement/runs`: a batch read as a batch.
 *
 * One row per **(batch, currency)**, never one per batch, and that pair is the
 * whole reason this type exists. A batch holding a USD clearing line and a USDC
 * micro-payment has no net, no gross and no fee total: the three would be sums of
 * two currencies, which is a number in minor units of nothing. Splitting the row
 * by currency makes the impossible sum impossible to express rather than merely
 * easy to get wrong.
 */
export interface SettlementRun {
  readonly batch: string;
  readonly currency: Currency;
  /** The kinds of movement in this batch, in vocabulary order. */
  readonly kinds: SettlementKind[];
  readonly lineCount: number;
  /** How many of those lines did not complete. */
  readonly failed: number;
  /** The value moved, signed, before fees. */
  readonly gross: Money;
  /** What the marketplace took across the batch. */
  readonly fees: Money;
  /** `gross - fees`. The same arithmetic a run signs off on. */
  readonly net: Money;
  /** The earliest line in the batch. */
  readonly startedAt: string;
  /** The latest, or `null` while the batch is still running. */
  readonly completedAt: string | null;
}

/**
 * `settlement/payouts`: money leaving for an ISP.
 *
 * A payout is a settlement line with `kind: "payout"`, and this type adds the two
 * things an operator asks about it that the movements list cannot answer: what
 * actually arrived, net of the fee, and why the ones that did not arrive did not.
 */
export interface Payout {
  readonly id: string;
  readonly batch: string;
  readonly counterparty: string;
  /** What was sent. Signed, by the ledger's convention. */
  readonly amount: Money;
  /** What the marketplace took. */
  readonly fee: Money;
  /** `amount - fee`. */
  readonly net: Money;
  readonly status: TransactionStatus;
  readonly occurredAt: string;
  readonly failureReason: string | null;
}
