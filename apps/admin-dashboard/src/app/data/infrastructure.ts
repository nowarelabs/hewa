"use client";

import type { InfrastructureNode, NodeKind, NodeStatus } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The infrastructure view's half of the console.
 */

export type { InfrastructureNode, NodeKind, NodeStatus };

export interface InfrastructureView {
  readonly rows: readonly InfrastructureNode[];
  readonly groups: readonly NodeKind[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The nodes the service is holding right now, and whether it has answered. */
export function useInfrastructure(): InfrastructureView {
  const state = useConsoleView("infrastructure");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
