"use client";

import type { LedgerEntryCreate, LedgerEntryRecord } from "@hewa/financial-dashboard-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * A journal entry, with both of its legs.
 *
 * `create` and never `patch` or `delete`: a posted entry is half of a pair that
 * balances, so correcting one means posting a reversing entry — another row a
 * reader can see — and removing one is not an operation this workspace offers.
 */
export type { LedgerEntryCreate, LedgerEntryRecord };

export function createLedgerEntry(
  body: LedgerEntryCreate,
): Promise<WriteResult<LedgerEntryRecord>> {
  return writeResource<LedgerEntryRecord>("ledger_entries", "POST", body);
}
