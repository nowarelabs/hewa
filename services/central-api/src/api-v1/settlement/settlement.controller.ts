import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { SettlementService } from "./settlement.service.js";

/**
 * `api/v1/settlement/{movements,runs,payouts}`.
 *
 * Three routes over one table, and none of them is the others with a filter on:
 * `runs` groups by batch and currency, `payouts` restricts to one kind and adds
 * the net figure, and `movements` is the ledger itself. The return types are the
 * `ConsolePayload` entries, so a field renamed in the contract fails the build
 * here rather than arriving as `undefined` in a panel.
 */
@Controller(`${API_V1_PREFIX}/settlement`)
@UseGuards(ServiceTokenGuard)
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Get("movements")
  async movements(): Promise<ConsolePayload["settlement/movements"]> {
    return this.service.readMovements();
  }

  @Get("runs")
  async runs(): Promise<ConsolePayload["settlement/runs"]> {
    return this.service.readRuns();
  }

  @Get("payouts")
  async payouts(): Promise<ConsolePayload["settlement/payouts"]> {
    return this.service.readPayouts();
  }
}
