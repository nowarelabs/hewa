"use client";

import type { SlaCredit, SlaMonitor, SlaRisk, SlaState } from "@hewa/console-types";

import { useConsoleSection, type SectionStatus } from "../state/query";

/**
 * The `slas` view's half of the console: three sections, three hooks.
 *
 * All three group by `SlaState`, and that is the one place the same vocabulary
 * appears three times on purpose — the state is the same question in each of them
 * ("is this healthy, slipping, or breached") and the sections differ in the rows
 * they answer it with, not in the answer.
 *
 * `credits` carries no `Money`. A credit is the product of a measured shortfall in
 * basis points and a contractual rate that is an exact `numerator / denominator`,
 * and a `Money` beside it would invite someone to multiply the two and land on a
 * currency figure that is not what would be invoiced.
 */

export type { SlaCredit, SlaMonitor, SlaRisk, SlaState };

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
 * happen to hold, so a chip can be pressed on a state no row currently belongs to
 * and still be there afterwards. All three SLA sections carry the same three
 * states, which is why the type is not generic here: there is nothing to
 * parameterise.
 */
export interface GroupedRowState<TRow> extends RowState<TRow> {
  readonly groups: readonly SlaState[];
}

/** `slas/commitments`: every monitored commitment, in whatever state it is in. */
export function useCommitments(): GroupedRowState<SlaMonitor> {
  const state = useConsoleSection("slas/commitments");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `slas/at_risk`: the commitments sliding towards their threshold. */
export function useAtRisk(): GroupedRowState<SlaRisk> {
  const state = useConsoleSection("slas/at_risk");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/** `slas/credits`: what each commitment's shortfall is worth, as an exact rate. */
export function useCredits(): GroupedRowState<SlaCredit> {
  const state = useConsoleSection("slas/credits");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
