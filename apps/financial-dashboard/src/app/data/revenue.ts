import type {
  Bill,
  BillStatus,
  CreditBasis,
  CreditRecord,
  Receivable,
  ReceivableBucket,
} from "@hewa/financial-dashboard-types";

import { useFinanceSection } from "../state/query";
import type { GroupedRowState } from "../state/rows";

/**
 * The revenue view's rows: what was billed, what is still owed, and what was
 * credited back.
 *
 * Row types, two state shapes, and one hook per section. No URL, no `fetch` and
 * no response code — the seam between a panel and the network is this file, so a
 * panel cannot grow a second opinion about where a row came from.
 *
 * `bills` and `receivables` read the same table at the service, and they are two
 * hooks rather than one hook with a flag: a flag would mean one panel deciding
 * which question it is asking, and the two answers differ by more than a filter.
 */

/** What was issued, including the paid and voided ones. */
export function useBills(): GroupedRowState<Bill, BillStatus> {
  const state = useFinanceSection("revenue/bills");

  return {
    rows: state.rows ?? [],
    status: state.status,
    groups: state.groups,
    refetch: state.refetch,
  };
}

/** What is still owed, aged. */
export function useReceivables(): GroupedRowState<Receivable, ReceivableBucket> {
  const state = useFinanceSection("revenue/receivables");

  return {
    rows: state.rows ?? [],
    status: state.status,
    groups: state.groups,
    refetch: state.refetch,
  };
}

/** Credits taken off bills. The only section of the three a caller can write. */
export function useCredits(): GroupedRowState<CreditRecord, CreditBasis> {
  const state = useFinanceSection("revenue/credits");

  return {
    rows: state.rows ?? [],
    status: state.status,
    groups: state.groups,
    refetch: state.refetch,
  };
}
