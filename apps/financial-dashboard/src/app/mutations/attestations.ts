"use client";

import type { AttestationCreate, AttestationRecord } from "@hewa/financial-dashboard-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * A published day of a city's revenue.
 *
 * `create` and never `patch`: a row that has not been signed is not a
 * half-finished attestation, it is nothing. There is no draft state, and so there
 * is nothing to edit and nothing to unpublish.
 */
export type { AttestationCreate, AttestationRecord };

export function createAttestation(
  body: AttestationCreate,
): Promise<WriteResult<AttestationRecord>> {
  return writeResource<AttestationRecord>("attestations", "POST", body);
}
