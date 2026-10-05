import type {
  AccountType,
  LedgerAccount,
  LedgerEntryRecord,
} from "@hewa/financial-dashboard-types";

import { useFinanceSection } from "../state/query";
import type { GroupedRowState, RowState } from "../state/rows";

/**
 * The ledger view's rows: the chart of accounts, and the entries that move them.
 *
 * `AccountType` is the vocabulary rather than a `kind` invented here, so the chip
 * that narrows the chart is the enum the account column is generated from.
 *
 * ## One read, two halves of one payload
 *
 * `ledger/ledger` answers with accounts *and* the entries posted against them, and this
 * hook returns both rather than two hooks over the same section. A section is one read:
 * two hooks for it would be two subscriptions to one query, two `status` values to keep
 * in step, and a postings list that could render against a different load state from the
 * accounts it names — the one place where "this entry moved that account" is being
 * claimed.
 *
 * The entries carry no groups. Nothing filters them here: the right column shows one
 * account's postings, which is a projection of the rows above it, not a vocabulary.
 */

export interface LedgerState {
  readonly accounts: GroupedRowState<LedgerAccount, AccountType>;
  readonly entries: RowState<LedgerEntryRecord>;
}

export function useLedger(): LedgerState {
  const state = useFinanceSection("ledger/ledger");

  // `state.rows` is the payload's `data`, and this section's data is the two halves
  // rather than a list — so the projection happens here, once, where the section that
  // has two halves is the only place that knows it.
  const data = state.rows;

  return {
    accounts: {
      rows: data?.accounts ?? [],
      status: state.status,
      groups: state.groups,
      refetch: state.refetch,
    },
    entries: {
      rows: data?.entries ?? [],
      status: state.status,
      refetch: state.refetch,
    },
  };
}
