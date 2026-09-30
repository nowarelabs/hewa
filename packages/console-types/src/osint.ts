/**
 * The `osint` view: open-source reporting.
 */
export type ReportCategory = "cia" | "military" | "economic" | "political" | "social";

export interface Report {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: ReportCategory;
  readonly source: string;
  /** An ISO 8601 instant. */
  readonly publishedAt: string;
  /**
   * A percentage, and a claim rather than a measurement.
   *
   * `confidence` is what a source says about itself, so it is a number in the
   * same units the panel bands it in and nothing downstream treats it as a
   * measurement. It is not a probability and it is not derived from anything.
   */
  readonly confidence: number;
}
