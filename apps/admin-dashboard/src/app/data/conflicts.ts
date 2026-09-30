"use client";

import type { Incident, IncidentKind, IncidentSeverity } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The conflicts view's half of the console.
 *
 * The incident kinds are the service's to name. The rail used to list four of the
 * five, which meant the bar's total and the bar's chips disagreed by one
 * whenever an election incident arrived — a row in the table that no chip
 * accounted for. `groups` is the whole vocabulary, so there is nothing in the
 * browser to keep in step.
 */

export type { Incident, IncidentKind, IncidentSeverity };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface IncidentView {
  readonly rows: readonly Incident[];
  readonly groups: readonly IncidentKind[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The incidents the service is holding right now, and whether it has answered. */
export function useIncidents(): IncidentView {
  const state = useConsoleView("conflicts");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
