/**
 * The `slas` view: every commitment being watched, and how it is going.
 *
 * This is the view that decides whether a month of trading was honest, because
 * an SLA is what a commitment is *called* once somebody has to be held to it.
 */
import type { SlaCommitment, SlaState } from "@hewa/marketplace-types";

export type { SlaCommitment, SlaState };

/** One monitored commitment on one node. */
export interface SlaMonitor {
  readonly id: string;
  /** The buyer the commitment is made to. */
  readonly account: string;
  /** The node being committed to, by the id `infrastructure` also uses. */
  readonly nodeId: string;
  readonly nodeName: string;
  readonly provider: string;
  /**
   * What was promised and what was delivered, plus the credit rate.
   *
   * Held as a {@link SlaCommitment} rather than as three loose numbers, so the
   * shape that decides a credit is the shape that travels, and so a commitment
   * cannot arrive with a rate and no target.
   */
  readonly sla: SlaCommitment;
  /** Parts per million of packets lost, 0 to 1_000_000. Whole numbers, not a percentage. */
  readonly packetLossPpm: number;
  /** Whole milliseconds. */
  readonly latencyP95Ms: number;
  /**
   * What the service last computed from {@link SlaMonitor.sla}.
   *
   * Stored rather than recomputed in the browser, because the comparison that
   * produces it is the same one a settlement run uses to issue a credit, and two
   * copies of a rule that decides money is how a commitment ends up "breached"
   * on a screen and absent from an invoice. `slaState` in
   * `@hewa/marketplace-types` is the single definition; the service's own test
   * asserts the two agree.
   */
  readonly state: SlaState;
  /** An ISO 8601 instant. */
  readonly measuredAt: string;
}

/**
 * `slas/at_risk`: the commitments closest to their threshold.
 *
 * A projection rather than a copy. `shortfallBps` is what the commitment is missing
 * by, and `trend` is whether that gap is widening — a commitment sitting two basis
 * points under target and stable is not the same problem as one two under and
 * falling, and a list of both sorted by shortfall puts the stable one first.
 */
export interface SlaRisk {
  readonly id: string;
  readonly account: string;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly provider: string;
  readonly state: SlaState;
  readonly sla: SlaCommitment;
  /** Basis points below target. `0` for a compliant commitment. */
  readonly shortfallBps: number;
  /**
   * Basis points the gap moved over the window, negative when it closed.
   *
   * A signed whole number rather than a direction enum, because "is it getting
   * worse" and "how much worse" are one measurement and a boolean would throw the
   * second half away.
   */
  readonly trendBps: number;
  readonly measuredAt: string;
}

/**
 * `slas/credits`: what each shortfall would cost.
 *
 * ## Why there is no `Money` here
 *
 * A credit is a fraction of a bill, and this service holds no bills — it holds
 * commitments, and what a commitment cost is the settlement view's question. So
 * what travels is the rate (`creditNumerator` / `creditDenominator`) and the
 * `creditablePoints` that `creditablePoints()` in `@hewa/marketplace-types`
 * computes from it, both exact.
 *
 * Publishing an amount would mean inventing the base it applies to: multiplying a
 * rate by a month nobody named produces a confident figure that is wrong, and
 * wrong in the one direction an operator would act on. The points are the part that
 * is knowable here; the money is somebody else's arithmetic.
 */
export interface SlaCredit {
  readonly commitmentId: string;
  readonly account: string;
  readonly nodeName: string;
  readonly provider: string;
  readonly state: SlaState;
  readonly targetBps: number;
  readonly actualBps: number;
  /** Whole percentage points missed, floored at 0. */
  readonly creditablePoints: number;
  /** The credit rate as an exact fraction: `creditNumerator / creditDenominator`. */
  readonly creditNumerator: number;
  readonly creditDenominator: number;
  readonly measuredAt: string;
}
