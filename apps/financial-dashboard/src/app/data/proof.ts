import type { AttestationRecord, AttestationVerdict } from "@hewa/financial-dashboard-types";

import { useFinanceSection } from "../state/query";
import type { GroupedRowState } from "../state/rows";

/**
 * The proof view's rows: a published day's revenue, per city.
 *
 * The vocabulary is the verdict — `complete` or `partial` — and it is per
 * *city-month* rather than per month, so filtering by it answers "which city is
 * short a day" instead of asking one question of two different customers.
 */

export function useAttestations(): GroupedRowState<AttestationRecord, AttestationVerdict> {
  const state = useFinanceSection("proof/attestations");

  return {
    rows: state.rows ?? [],
    status: state.status,
    groups: state.groups,
    refetch: state.refetch,
  };
}
