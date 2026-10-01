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
