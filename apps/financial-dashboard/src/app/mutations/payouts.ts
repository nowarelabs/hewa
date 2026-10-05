"use client";

import type { PayoutPatch, PayoutRecord } from "@hewa/financial-dashboard-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * A payout's status, and the reason a failure carries.
 *
 * `PATCH` and never `POST`: an obligation is produced by settling a bill, and this
 * dashboard reports the obligation rather than creating one.
 */
export type { PayoutPatch, PayoutRecord };

export function patchPayout(id: string, body: PayoutPatch): Promise<WriteResult<PayoutRecord>> {
  return writeResource<PayoutRecord>("payouts", "PATCH", body, id);
}
