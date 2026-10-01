/**
 * The `settlement` view: how value moves, and what stopped it moving.
 *
 * An ISP sells bandwidth, a buyer buys it, and somewhere between them the money
 * has to land in the right wallet with the right amount in it. This view is that
 * middle, and it is the only place in the console where a figure is a number
 * rather than a measurement.
 */
import type { Money, TransactionStatus } from "@hewa/marketplace-types";

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
