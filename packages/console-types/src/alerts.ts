/**
 * The `alerts` view: things that need attention now.
 *
 * A record carries what is true, not how it is drawn. There is no colour, icon or
 * Tailwind class anywhere in this file, and there could not be: an endpoint cannot
 * send one, and a record that carried a `tint` would be asserting that the shell's
 * palette is a property of an alert.
 *
 * An alert here is something the network did or failed to do — a corridor over
 * budget, a settlement that did not clear, a commitment sliding towards its
 * threshold — and it is answerable: each one names the thing it is about, who
 * operates it, how much traffic is affected, how many commitments ride on it, and
 * what the automation already did about it. An alert that cannot be acted on is
 * a notification, and a notification is not what an operations console is for.
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

/**
 * Every {@link AlertSeverity}, worst first.
 *
 * A runtime list beside the union so a rail or a filter bar is built from the
 * vocabulary rather than from whatever the rows happen to hold, and typed
 * `readonly AlertSeverity[]` so a severity added to the union is a compile error
 * here rather than a chip that sorts to the bottom.
 */
export const ALERT_SEVERITIES: readonly AlertSeverity[] = ["critical", "high", "medium", "low"];

/** How each severity is written where a human reads it. */
export const ALERT_SEVERITY_TITLES: Readonly<Record<AlertSeverity, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * What sort of thing this is, in the vocabulary an operator acts on.
 *
 * Five categories and not one per alert type, because the category is what
 * decides who gets paged and a per-type vocabulary would be a per-type rota.
 */
export type AlertCategory = "sla" | "capacity" | "outage" | "billing" | "security";

/** Every {@link AlertCategory}, in the order a rota reads them. */
export const ALERT_CATEGORIES: readonly AlertCategory[] = [
  "sla",
  "capacity",
  "outage",
  "billing",
  "security",
];

export interface Alert {
  readonly id: string;
  readonly title: string;
  /**
   * The measurement, in a sentence.
   *
   * "Latency up 45 ms on the primary path, failover engaged." A figure with a
   * magnitude, the thing it happened to, and what is being done — because the
   * difference between an alert that is acknowledged and one that is fixed is
   * usually whether the operator can tell those three apart.
   */
  readonly description: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  /** The node, order or settlement this is about, by the id its own view uses. */
  readonly entityId: string;
  /** That entity's own name, so a panel need not join across views to label it. */
  readonly entityLabel: string;
  readonly provider: string;
  readonly city: string;
  readonly lat: number;
  readonly lng: number;
  /** Traffic affected, in whole gigabits per second. */
  readonly impactedGbps: number;
  /** How many live commitments name this entity. Zero is a real and useful answer. */
  readonly affectedSlas: number;
  /**
   * What the automation did, or `null` when nothing did anything.
   *
   * Nullable on purpose and not empty-string: "we did not act" and "we acted and
   * what we did was blank" are different facts, and only one of them should ever
   * render as a dash.
   */
  readonly automatedAction: string | null;
  /** An ISO 8601 instant. The service sends the string; the panel formats it. */
  readonly raisedAt: string;
}
