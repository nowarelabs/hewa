"use client";

import type { Settlement, SettlementKind, SettlementRun, Payout } from "@hewa/console-types";
import type { TransactionStatus } from "@hewa/marketplace-types";

import { useConsoleSection, type SectionStatus } from "../state/query";

/**
 * The `settlement` view's half of the console: three sections, three hooks.
 *
 * `movements` is every line, `payouts` is the subset leaving for an ISP, and
 * `runs` is a batch read as a batch — which is a different grain from both and
 * cannot be derived from either, because a run is keyed by `(batch, currency)`
 * and a currency total over two currencies is a number in minor units of nothing.
 */

export type { Payout, Settlement, SettlementKind, SettlementRun };

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
 * happen to hold, so a chip can be pressed on a group no row currently belongs to
 * and still be there afterwards. `runs` is typed `RowState` because it has none:
 * a batch is a mix of completed and failed lines, and a status it belongs to is
 * not a fact about the batch.
 */
export interface GroupedRowState<TRow, TGroup extends string> extends RowState<TRow> {
  readonly groups: readonly TGroup[];
}

/** `settlement/movements`: every movement of value, cleared or not. */
export function useMovements(): GroupedRowState<Settlement, SettlementKind> {
  const state = useConsoleSection("settlement/movements");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}

/**
 * `settlement/runs`: one row per batch and currency.
 *
 * Ungrouped. The ledger statuses are the vocabulary on `movements` and `payouts`,
 * where a row *is* a transaction; a run is a set of transactions, and the only
 * state that belongs to it is derived from how many of its lines failed. That is
 * a column in the panel, not a vocabulary the service sends, so the panel derives
 * its two chips from a declared pair rather than from `meta.groups`.
 */
export function useRuns(): RowState<SettlementRun> {
  const state = useConsoleSection("settlement/runs");

  return {
    rows: state.data ?? [],
    status: state.status,
    refetch: state.refetch,
  };
}

/** `settlement/payouts`: money leaving for an ISP. */
export function usePayouts(): GroupedRowState<Payout, TransactionStatus> {
  const state = useConsoleSection("settlement/payouts");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
