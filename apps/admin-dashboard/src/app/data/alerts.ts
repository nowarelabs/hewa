"use client";

import type { Alert, AlertCategory, AlertSeverity } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The alerts view's half of the console, and nothing else.
 */

export type { Alert, AlertCategory, AlertSeverity };

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
