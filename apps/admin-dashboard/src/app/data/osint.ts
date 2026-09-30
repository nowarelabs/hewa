"use client";

import type { Report, ReportCategory } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The osint view's half of the console.
 *
 * The report categories are the service's to name. The rail had four of the five
 * — `social` was in the data and not in the bar — so the chip row was counting a
 * subset of what the feed held and had no way to say so.
 */

export type { Report, ReportCategory };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface ReportView {
  readonly rows: readonly Report[];
  readonly groups: readonly ReportCategory[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The reports the service is holding right now, and whether it has answered. */
export function useReports(): ReportView {
  const state = useConsoleView("osint");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
