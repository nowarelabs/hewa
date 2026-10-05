import { useQuery } from "@tanstack/react-query";
import {
  FINANCE_SECTION_ENDPOINTS,
  type FinanceData,
  type FinanceGroups,
  type FinancePayload,
  type FinanceSectionKey,
} from "@hewa/financial-dashboard-types";
import { ResponseCode } from "@hewa/response-codes";

/**
 * One section's rows, and whether they have arrived yet.
 *
 * The only place in the app that fetches. A panel reads a hook from `data/` and
 * never a URL, so the endpoint this dashboard is allowed to ask for is decided in
 * one file — and it is the finance contract's `FINANCE_SECTION_ENDPOINTS` that names
 * it, which is why adding a section to the contract adds a route here rather than a
 * string in a panel.
 *
 * Three states, not two: `pending` is a request in flight, `failed` is a request
 * that came back wrong, and `ready` is an answer. A panel that rendered `[]` for both
 * of the first two would draw an empty table for a section that has never loaded,
 * which is indistinguishable from a month with no bills in it.
 */

/** How long an answer is treated as current. Finance rows move between billing runs. */
export const STALE_TIME_MS = 30_000;

export type SectionStatus = "pending" | "failed" | "ready";

export interface SectionState<TSection extends FinanceSectionKey> {
  readonly status: SectionStatus;
  readonly rows: FinanceData<TSection> | undefined;
  /**
   * The vocabulary this section filters on, including groups no row holds.
   *
   * Empty until the first answer arrives, and `status` is what says which: a panel
   * draws its filter bar from the groups when the section is `ready` and draws a
   * skeleton instead before that, so a chip never appears after the panel is already
   * holding rows. Keeping it non-optional is the point — a panel that had to write
   * `groups ?? []` would be inventing a second answer to "which values may this
   * column hold" every time it drew a filter bar.
   *
   * A refetch does not empty it: React Query keeps the last answer while it asks for
   * the next one, so the chips do not blink.
   */
  readonly groups: FinanceGroups<TSection>;
  readonly refetch: () => void;
}

/** Before the first answer there is no vocabulary to offer, and no row to hold one. */
const NO_GROUPS: readonly never[] = [];

async function fetchSection<TSection extends FinanceSectionKey>(
  section: TSection,
): Promise<FinancePayload[TSection]> {
  const path = FINANCE_SECTION_ENDPOINTS[section];

  const response = await fetch(path, { headers: { accept: "application/json" } });

  if (!response.ok) {
    // The status, and never the body: a 500 from the service may carry a customer's
    // name in it, and this string reaches a panel's empty state. The envelope's `code`
    // is a vocabulary we chose and can be shown; a vendor's error body is not ours.
    throw new Error(`${path} answered ${response.status}`);
  }

  const envelope = (await response.json()) as FinancePayload[TSection];

  if (envelope.code !== ResponseCode.Ok) {
    throw new Error(`${path} answered with code ${envelope.code}`);
  }

  return envelope;
}

export function useFinanceSection<TSection extends FinanceSectionKey>(
  section: TSection,
): SectionState<TSection> {
  const query = useQuery({
    queryKey: ["finance", section],
    queryFn: () => fetchSection(section),
    staleTime: STALE_TIME_MS,
  });

  const envelope = query.data;

  return {
    status: query.isError ? "failed" : envelope === undefined ? "pending" : "ready",
    rows: envelope?.data,
    groups: (envelope?.meta.groups ?? NO_GROUPS) as FinanceGroups<TSection>,
    refetch: () => {
      void query.refetch();
    },
  };
}
