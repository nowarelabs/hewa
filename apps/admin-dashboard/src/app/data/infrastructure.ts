"use client";

import type {
  InfrastructureNode,
  NodeHeadroom,
  NodeKind,
  NodeStatus,
  ProviderFootprint,
} from "@hewa/console-types";

import { useConsoleSection, type SectionStatus } from "../state/query";

/**
 * The `infrastructure` view's half of the console: three sections, three hooks.
 *
 * `nodes` and `headroom` carry the same nodes and answer different questions —
 * "where does traffic run" against "where can the next order go" — so they are
 * two destinations with two endpoints and two hooks, not one list and a derived
 * column. `providers` is a rollup neither of them can express.
 */

export type { InfrastructureNode, NodeHeadroom, NodeKind, NodeStatus, ProviderFootprint };

/** A section that has rows to show, and how far along it is. */
export interface RowState<TRow> {
  readonly rows: readonly TRow[];
  readonly status: SectionStatus;
  readonly refetch: () => void;
}

/**
 * A section that also has a group vocabulary to filter on.
 *
 * `groups` is `meta.groups` from the response and not the set of values the rows
 * happen to hold. Two sections in this console send no vocabulary at all and are
 * typed `RowState` rather than `GroupedRowState` with an empty list, so that a
 * panel cannot read `groups` from a section that has none.
 */
export interface GroupedRowState<TRow, TGroup extends string> extends RowState<TRow> {
  readonly groups: readonly TGroup[];
}

/** `infrastructure/nodes`: every node as it stands. */
export function useNodes(): GroupedRowState<InfrastructureNode, NodeKind> {
  const state = useConsoleSection("infrastructure/nodes");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `infrastructure/headroom`: how much room each node has left. */
export function useHeadroom(): GroupedRowState<NodeHeadroom, NodeKind> {
  const state = useConsoleSection("infrastructure/headroom");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/**
 * `infrastructure/providers`: who supplies the network.
 *
 * Ungrouped, because a provider is already one row per provider and a chip that
 * filtered the rollup by the column it is keyed on would select exactly the row it
 * was built from. The service sends an empty vocabulary to match.
 */
export function useProviders(): RowState<ProviderFootprint> {
  const state = useConsoleSection("infrastructure/providers");

  return {
    rows: state.data ?? [],
    status: state.status,
    refetch: state.refetch,
  };
}
