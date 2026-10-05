import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { CreditCreate, CreditRecord } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import { CreditsWriteService } from "./credits.write.service.js";
import { creditCreateSchema } from "./finance-write-schemas.js";
import { ZodBody } from "../zod-pipe.js";

/**
 * `api/v1/data/credits` — a `POST` and nothing else.
 *
 * ## A credit is a record, not a state
 *
 * So there is no `PATCH` to bind: there is no state to move between, and "editing" a
 * credit would be an act with no second outcome. Correcting one is another credit
 * against the same bill, with its own note, which leaves `revenue/credits` holding
 * both — the same way the ledger holds a reversal beside the thing it reverses.
 *
 * `POST` answers 201 with the credit, and the credit carries the bill's `ispId`,
 * `ispName`, `month` and `currency` although the row does not: those four are the
 * bill's, and the service reads the bill to answer with them.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/credits`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class CreditsWriteController {
  constructor(private readonly service: CreditsWriteService) {}

  /**
   * `POST /api/v1/data/credits`.
   *
   * 409 when the id is taken. 404 when the `billId` names no bill — the credit is
   * taken off a bill, so a missing bill is a missing resource rather than a bad
   * field. 422 when `amountMinor` is positive, naming the sign: a credit that adds is
   * a charge under a column named after a reduction, and `revenue/receivables` would
   * read it as money still owed.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(creditCreateSchema, "credit create")) body: CreditCreate,
  ): Promise<CreditRecord> {
    return this.service.create(body);
  }
}
