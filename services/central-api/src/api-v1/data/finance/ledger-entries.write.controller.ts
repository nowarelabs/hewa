import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { LedgerEntryCreate, LedgerEntryRecord } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import { ledgerEntryCreateSchema } from "./finance-write-schemas.js";
import { LedgerEntriesWriteService } from "./ledger-entries.write.service.js";
import { ZodBody } from "../zod-pipe.js";

/**
 * `api/v1/data/ledger_entries` — a `POST` and nothing else.
 *
 * ## The write path is the only place a balance can be refused
 *
 * `ledger/ledger` reads balances, so it can only report a ledger that is wrong. This
 * route is where the ledger is made, which is why the balance is asserted here rather
 * than discovered in a report three weeks later: `journalEntry` in
 * `@hewa/ledger-accounting` refuses legs that do not foot, and the refusal is a 422
 * naming the difference rather than a trial balance that is off by 100 minor units.
 *
 * ## No `PATCH`, no `DELETE`, and the schema says why
 *
 * `finance_ledger_entries` has no `updatedAt` column, because an entry is not edited:
 * a correction is a second, reversing entry. `DELETE` would be worse than a missing
 * verb — it would remove one half of a pair that balances, which is the only way this
 * workspace can produce a ledger that does not foot by intent.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/ledger_entries`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class LedgerEntriesWriteController {
  constructor(private readonly service: LedgerEntriesWriteService) {}

  /**
   * `POST /api/v1/data/ledger_entries`.
   *
   * 201 with the entry and its legs. 409 when the `reference` has been posted
   * before — it is the idempotence key, so a pipeline that timed out and retried
   * gets the conflict rather than a second accrual. 422 when a leg names an account
   * outside the chart or in another currency, and when the legs do not balance.
   *
   * The `id` is required in the body rather than generated: a retry after a timeout
   * must be able to send the same entry twice and have the second refused, which a
   * generated id could not do.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(ledgerEntryCreateSchema, "ledger entry create")) body: LedgerEntryCreate,
  ): Promise<LedgerEntryRecord> {
    return this.service.create(body);
  }
}
