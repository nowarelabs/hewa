"use client";

import type { CreditCreate, CreditRecord } from "@hewa/financial-dashboard-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * A credit taken off a bill.
 *
 * `create` and never `patch`: a credit is issued whole, so a partial update of one
 * would be an operator changing what somebody was given back after the ISP has
 * been told. There is no `patchCredit`, and that absence is the contract.
 */
export type { CreditCreate, CreditRecord };

export function createCredit(body: CreditCreate): Promise<WriteResult<CreditRecord>> {
  return writeResource<CreditRecord>("credits", "POST", body);
}
