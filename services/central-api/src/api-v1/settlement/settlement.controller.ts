import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { SettlementService } from "./settlement.service.js";

/**
 * `api/v1/settlement`.
 *
 * Every movement of value, and what stopped it moving.
 *
 * One `@Get` and one delegation, awaited so a query failure is thrown from the
 * handler rather than floating out of it. The rows are selected in the service
 * because the
 * panel is not the only thing that asks this question — a settlement run, a test and
 * a future export all ask the same one — and a controller that assembled its own
 * answer would be a third place to keep it honest.
 *
 * The return type is `ConsolePayload["settlement"]`, so a field renamed in the shared
 * contract is a build failure here rather than an `undefined` in a panel.
 */
@Controller(`${API_V1_PREFIX}/settlement`)
@UseGuards(ServiceTokenGuard)
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Get()
  async settlement(): Promise<ConsolePayload["settlement"]> {
    return this.service.read();
  }
}
