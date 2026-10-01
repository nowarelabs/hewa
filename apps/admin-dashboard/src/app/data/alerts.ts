"use client";

import type {
  Alert,
  AlertCategory,
  AlertSeverity,
  CapacityPressure,
  OutageGroup,
  SecurityEvent,
} from "@hewa/console-types";

import { useConsoleSection, type SectionStatus } from "../state/query";

/**
 * The `alerts` view's half of the console: four sections, four hooks.
 *
 * Three of the four are grouped views of the same alerts table, and that is the
 * point of having them as destinations rather than as filters. `outages`, `capacity`
 * and `security` each collapse repetition that the feed cannot: one outage is four
 * alerts, one node over budget is a row plus its current headroom, one intrusion is
 * an alert per affected customer. `feed` is the uncollapsed list, and it stays the
 * uncollapsed list on purpose — the operator who needs all four rows is the operator
 * the group hid them from.
 *
 * All four group by severity, because severity is the triage control and a category
 * bar answers a different question — one an operator asks by filtering. `category` is
 * on every `Alert` row, so a panel may use it; only one of them gets a chip.
 */

export type { Alert, AlertCategory, AlertSeverity, CapacityPressure, OutageGroup, SecurityEvent };

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
 * happen to hold, so a chip can be pressed on a severity no row currently belongs
 * to and still be there afterwards. All four alert sections carry the same
 * severities, which is why the type is not generic here: there is nothing to
 * parameterise.
 */
export interface GroupedRowState<TRow> extends RowState<TRow> {
  readonly groups: readonly AlertSeverity[];
}

/** `alerts/feed`: every alert, one row each. */
export function useAlertFeed(): GroupedRowState<Alert> {
  const state = useConsoleSection("alerts/feed");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `alerts/outages`: what is down, one row per thing that broke. */
export function useOutages(): GroupedRowState<OutageGroup> {
  const state = useConsoleSection("alerts/outages");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `alerts/capacity`: alerts about running out, beside the headroom that is left. */
export function useCapacityPressure(): GroupedRowState<CapacityPressure> {
  const state = useConsoleSection("alerts/capacity");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `alerts/security`: who got in, one row per entity, with what was done. */
export function useSecurityEvents(): GroupedRowState<SecurityEvent> {
  const state = useConsoleSection("alerts/security");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
