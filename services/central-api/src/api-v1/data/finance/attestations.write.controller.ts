import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { AttestationCreate, AttestationRecord } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import { attestationCreateSchema } from "./finance-write-schemas.js";
import { AttestationsWriteService } from "./attestations.write.service.js";
import { ZodBody } from "../zod-pipe.js";

/**
 * `api/v1/data/attestations` — a `POST`, and it is how an attestation is published.
 *
 * ## There is no draft, so there is nothing else
 *
 * No `PATCH`: a row here is signed and published, and an unpublished figure is not a
 * half-finished attestation — it does not exist. No `PUT`: the day's figures are what
 * were attested, and a body that could replace them would be a second claim about the
 * same day rather than a correction of the first. No `DELETE`: withdrawing a
 * published attestation is a fact an operator needs to see, and the way this table
 * keeps one is a second, reversing entry rather than a hole.
 *
 * ## What this route is not
 *
 * It is not a signer. The authority of an attestation is the signature over the
 * Merkle root, which lives in `@hewa/revenue-proof-protocol` and is not reachable
 * from here; this table records what was published and what it said. The comments on
 * `finance_attestations` in `db/schema.ts` say the same thing about the absence of a
 * `merkle_root` column, and the reason is the same: a value a form could set would
 * agree with the books by being typed.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/attestations`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class AttestationsWriteController {
  constructor(private readonly service: AttestationsWriteService) {}

  /**
   * `POST /api/v1/data/attestations`.
   *
   * 201 with the attestation, stamped with the server's clock — the body carries no
   * `publishedAt`, so nothing here can be backdated. 409 when that city has already
   * published that day of that month.
   *
   * The response carries a real `verdict`: the city-month is counted over the table
   * after the insert, so publishing the last day of a month answers `complete` on the
   * `POST` rather than one section read later.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(attestationCreateSchema, "attestation create")) body: AttestationCreate,
  ): Promise<AttestationRecord> {
    return this.service.create(body);
  }
}
