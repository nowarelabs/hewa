"use client";

import type { Flight } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The flights view's half of the console.
 *
 * The operator is on the flight. It was a callsign-prefix table in this file, so
 * adding a domestic prefix meant editing the browser to make a column the service
 * already had data for appear — and three of the flights were on carriers the
 * table had never heard of, which is what their `Unknown` was.
 *
 * There is no timer here. The positions used to be nudged every few seconds by
 * `createTickingStore`, which invented movement rather than observing it: a
 * figure from `Math.random()` is not more live than one that is invented once and
 * sent, and it cost an interval, a store, and a second copy of these records.
 */

export type { Flight };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface FlightView {
  readonly rows: readonly Flight[];
  readonly groups: readonly string[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The flights the service is holding right now, and whether it has answered. */
export function useFlights(): FlightView {
  const state = useConsoleView("flights");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
