/**
 * The `alerts` view: things that need attention now.
 *
 * A record carries what is true, not how it is drawn. There is no colour, icon or
 * Tailwind class anywhere in this file, and there could not be: an endpoint cannot
 * send one, and a record that carried a `tint` would be asserting that the shell's
 * palette is a property of an alert.
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type AlertCategory = "security" | "conflict" | "economic" | "weather" | "health" | "traffic";

export interface Alert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  readonly lat: number;
  readonly lng: number;
  readonly county: string;
  /** An ISO 8601 instant. The service sends the string; the panel formats it. */
  readonly raisedAt: string;
}
