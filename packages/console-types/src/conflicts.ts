/**
 * The `conflicts` view: incidents on the ground.
 */
export type IncidentKind = "armed" | "protest" | "election" | "resource" | "tribal";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly county: string;
  readonly subCounty: string;
  readonly kind: IncidentKind;
  readonly severity: IncidentSeverity;
  readonly casualties: number;
  readonly verified: boolean;
  /** An ISO 8601 instant. */
  readonly reportedAt: string;
}
