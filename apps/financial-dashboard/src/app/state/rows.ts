/**
 * The two shapes every section hook returns.
 *
 * In `state/` rather than in one view's `data/` module, because all four views return
 * them: a `GroupedRowState` defined in `data/revenue.ts` and imported by the other
 * three makes the revenue view the owner of a shape settlement and ledger also answer
 * with, and the next person to add a fifth view has to decide which module it is.
 *
 * `rows` is the section's rows and `groups` is the vocabulary it filters on, which is
 * why the two are separate: the rows are a list of records and the groups are the
 * values one of their columns may hold — including the ones no row currently holds.
 */

export type RowStatus = "pending" | "failed" | "ready";

export interface RowState<TRow> {
  readonly rows: readonly TRow[];
  readonly status: RowStatus;
  readonly refetch: () => void;
}

export interface GroupedRowState<TRow, TGroup extends string> extends RowState<TRow> {
  readonly groups: readonly TGroup[];
}
