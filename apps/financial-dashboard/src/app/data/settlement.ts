import type { PayoutRecord, PayoutStatus } from "@hewa/financial-dashboard-types";

import { useFinanceSection } from "../state/query";
import type { GroupedRowState } from "../state/rows";

/**
 * The settlement view's rows: money leaving the marketplace.
 *
 * One section and one hook. The vocabulary is `PayoutStatus`, so the chip a panel
 * draws and the status a `PATCH` accepts are the same list read from
 * `@hewa/settlement-domain` — the panel cannot offer a state the service refuses.
 */

export function usePayouts(): GroupedRowState<PayoutRecord, PayoutStatus> {
  const state = useFinanceSection("settlement/payouts");

  return {
    rows: state.rows ?? [],
    status: state.status,
    groups: state.groups,
    refetch: state.refetch,
  };
}
