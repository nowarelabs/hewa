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

/**
 * How each category is written where a human reads it.
 *
 * The category decides who gets paged, so its label is read by whoever is on that
 * rota rather than by whoever built the table, and `billing` is the one that most
 * needs to be spelled out. Keyed by the value a row carries, like every other
 * titles map in this package, and a `Record<AlertCategory, string>` so a category
 * added to the union without a title is a compile error.
 */
export const ALERT_CATEGORY_TITLES: Readonly<Record<AlertCategory, string>> = {
  sla: "SLA",
  capacity: "Capacity",
  outage: "Outage",
  billing: "Billing",
  security: "Security",
};

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

/**
 * `alerts/outages`: what is down, grouped so one outage is not four alerts.
 *
 * The single most important thing this console has to stop doing is showing one
 * outage four times. A subsea cable that drops raises an alert per commitment
 * riding on it, per peering session and per customer, and a feed of those is a
 * feed that hides its own severity behind repetition: the critical one is on row
 * two of four identical rows.
 *
 * So this section groups by the thing that broke and sums the rest. `worstSeverity`
 * is the group's most severe member, `alertCount` is how many alerts it produced,
 * and the two together are what an operator actually needs — how bad, and how
 * much of the same thing.
 */
export interface OutageGroup {
  /** The entity the alerts are about, which is what they are grouped by. */
  readonly entityId: string;
  readonly entityLabel: string;
  readonly provider: string;
  readonly city: string;
  readonly lat: number;
  readonly lng: number;
  readonly alertCount: number;
  /** The most severe severity among the grouped alerts, worst first. */
  readonly worstSeverity: AlertSeverity;
  /** Traffic affected, summed across the group. */
  readonly impactedGbps: number;
  /** Commitments riding on it, taken as the worst member's count. */
  readonly affectedSlas: number;
  /** The first alert in the group. */
  readonly firstRaisedAt: string;
  /** The most recent, which is what makes this group the current state. */
  readonly lastRaisedAt: string;
  /** What the automation did, when it did something. */
  readonly automatedAction: string | null;
}

/**
 * `alerts/capacity`: alerts about running out, beside the headroom that is left.
 *
 * A join, and the join is the section. A capacity alert says "this node is at
 * 97%", which is the alert's own account of a figure the infrastructure view also
 * holds and may now disagree with. Reading the alert beside the node's *current*
 * headroom is what turns "97%" into "97% and rising, 24 Gbps left", and the two
 * numbers cannot come from two requests that ran at different times.
 */
export interface CapacityPressure {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly provider: string;
  readonly city: string;
  readonly alertCount: number;
  readonly worstSeverity: AlertSeverity;
  readonly impactedGbps: number;
  /** Installed capacity of the node, or `null` when the alert names no known node. */
  readonly capacityGbps: number | null;
  /**
   * Capacity still free, or `null` when the alert names no known node.
   *
   * `null` rather than zero: an alert about a corridor that is not one of our
   * nodes has no headroom, and reporting zero would put an entry in a
   * "nodes with room" table that has none at all.
   */
  readonly headroomGbps: number | null;
  readonly lastRaisedAt: string;
}

/**
 * `alerts/security`: who got in, and what was done about it.
 *
 * Grouped by the account rather than listed, because the same intrusion against a
 * provider's edge raises one alert per affected customer and the operator's
 * question is "how big is this and have we already answered it" — which is the
 * count and the action, not forty rows saying "unauthorised access".
 */
export interface SecurityEvent {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly provider: string;
  readonly city: string;
  readonly eventCount: number;
  readonly worstSeverity: AlertSeverity;
  /** The most recent sighting, which is what makes this the current state. */
  readonly lastSeenAt: string;
  /** What the automation did, when it did something. */
  readonly automatedAction: string | null;
}
