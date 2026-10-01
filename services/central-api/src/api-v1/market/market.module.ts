import { Module } from "@nestjs/common";

import { ServiceAuthModule } from "../service-auth.module.js";
import { MarketController } from "./market.controller.js";
import { MarketService } from "./market.service.js";

/**
 * The `market` view: one controller, one service, and the guard that protects them.
 *
 * `ServiceAuthModule` is imported here rather than only at the root so this module is
 * self-sufficient — a test that builds `marketModule` on its own still gets a
 * resolvable token provider, and the `@UseGuards` cannot fail at resolution for want
 * of one. It is `@Global`, so importing it from five modules still constructs it
 * once.
 *
 * Unlike the record modules this replaced, the view has a provider, because it now
 * reads rows rather than importing a constant. That is the whole structural change:
 * `DB` is `@Global`, so the service injects it without declaring it, and a view
 * cannot come to exist as a route with no module behind it.
 */
@Module({
  imports: [ServiceAuthModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
