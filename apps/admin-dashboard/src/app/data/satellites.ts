"use client";

import type { Satellite, SatelliteKind } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The satellites view's half of the console.
 *
 * `scientific` is a kind the service names and the rail does not — an air console
 * has no business tracking a science mission, so its rail entry was left out. It
 * is still a satellite in the catalogue and it still belongs in the bar's total,
 * so the vocabulary comes from the service and the rail decides what to offer.
 *
 * There is no timer here. The orbits used to be advanced every few seconds in the
 * browser, which meant the list on the left and the table in the middle could
 * disagree about where a satellite was — two subscribers, one value — and the
 * number on screen was one nobody had measured.
 */

export type { Satellite, SatelliteKind };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface SatelliteView {
  readonly rows: readonly Satellite[];
  readonly groups: readonly SatelliteKind[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The satellites the service is holding right now, and whether it has answered. */
export function useSatellites(): SatelliteView {
  const state = useConsoleView("satellites");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
