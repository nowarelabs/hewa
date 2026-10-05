"use client";

import type { Bill, BillPatch } from "@hewa/financial-dashboard-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * A bill's status and dispute reason. Nothing else.
 *
 * `PATCH` and never `POST`: an invoice is issued by the billing run, and the one
 * thing this dashboard can do to a bill afterwards is move it through its own
 * lifecycle. There is no `createBill`, and that absence is the contract.
 */
export type { Bill, BillPatch };

export function patchBill(id: string, body: BillPatch): Promise<WriteResult<Bill>> {
  return writeResource<Bill>("bills", "PATCH", body, id);
}
