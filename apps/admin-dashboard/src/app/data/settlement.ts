"use client";

import type { Settlement, SettlementKind } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The settlement view's half of the console.
 */

export type { Settlement, SettlementKind };

export interface SettlementView {
  readonly rows: readonly Settlement[];
  readonly groups: readonly SettlementKind[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The settlements the service is holding right now, and whether it has answered. */
export function useSettlements(): SettlementView {
  const state = useConsoleView("settlement");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
