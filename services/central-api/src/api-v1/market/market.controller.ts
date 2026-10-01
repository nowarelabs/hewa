import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { MarketService } from "./market.service.js";

/**
 * `api/v1/market/{book,prices,venues}`.
 *
 * Three routes over one service, and the return types are
 * `ConsolePayload["market/book"]` and its siblings — so a field renamed in the
 * shared contract is a build failure here rather than an `undefined` in a panel.
 *
 * Each `@Get` is awaited so a query failure is thrown from the handler rather
 * than floating out of it. The rows are selected in the service because the
 * panels are not the only things that ask these questions — a settlement run, a
 * test and a future export all ask the same ones — and a controller that assembled
 * its own answer would be a third place to keep it honest.
 *
 * There is no `@Get()` on this controller. A bare `GET /api/v1/market` would be
 * a document that all three of these sections are slices of, which is the shape
 * the rails used to navigate: one endpoint, three ways of looking at it. The
 * dashboard does not call it and no test asserts it, so its absence is the
 * assertion.
 */
@Controller(`${API_V1_PREFIX}/market`)
@UseGuards(ServiceTokenGuard)
export class MarketController {
  constructor(private readonly service: MarketService) {}

  @Get("book")
  async book(): Promise<ConsolePayload["market/book"]> {
    return this.service.readBook();
  }

  @Get("prices")
  async prices(): Promise<ConsolePayload["market/prices"]> {
    return this.service.readPrices();
  }

  @Get("venues")
  async venues(): Promise<ConsolePayload["market/venues"]> {
    return this.service.readVenues();
  }
}
