"use client";

import type { Alert, AlertCategory, AlertSeverity } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The alerts view's half of the console, and nothing else.
 *
 * A panel needs an alert's severity and a list of the severities the view holds,
 * and it gets both from here — the severities as `groups` off the response,
 * because the service owns the vocabulary and a hardcoded copy in the browser is
 * one more list that can drift from the data it describes.
 *
 * The records are not here. They are in central-api, and this module is the
 * boundary between the two: the panel imports from `../data/alerts` and does not
 * know that an HTTP request happens somewhere below.
 */

export type { Alert, AlertCategory, AlertSeverity };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface AlertView {
  readonly rows: readonly Alert[];
  readonly groups: readonly AlertSeverity[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The alerts the service is holding right now, and whether it has answered. */
export function useAlerts(): AlertView {
  const state = useConsoleView("alerts");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
