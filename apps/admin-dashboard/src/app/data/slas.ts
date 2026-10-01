"use client";

import type { SlaCommitment, SlaMonitor, SlaState } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The SLAs view's half of the console.
 */

export type { SlaCommitment, SlaMonitor, SlaState };

export interface SlasView {
  readonly rows: readonly SlaMonitor[];
  readonly groups: readonly SlaState[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The SLA monitors the service is holding right now, and whether it has answered. */
export function useSlas(): SlasView {
  const state = useConsoleView("slas");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
