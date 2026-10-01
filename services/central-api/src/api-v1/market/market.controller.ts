import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { MarketService } from "./market.service.js";

/**
 * `api/v1/market`.
 *
 * The market document: the book, and every figure derived from it.
 *
 * One `@Get` and one delegation, awaited so a query failure is thrown from the
 * handler rather than floating out of it. The rows are selected in the service
 * because the
 * panel is not the only thing that asks this question — a settlement run, a test and
 * a future export all ask the same one — and a controller that assembled its own
 * answer would be a third place to keep it honest.
 *
 * The return type is `ConsolePayload["market"]`, so a field renamed in the shared
 * contract is a build failure here rather than an `undefined` in a panel.
 */
@Controller(`${API_V1_PREFIX}/market`)
@UseGuards(ServiceTokenGuard)
export class MarketController {
  constructor(private readonly service: MarketService) {}

  @Get()
  async market(): Promise<ConsolePayload["market"]> {
    return this.service.read();
  }
}
