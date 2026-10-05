import { Module } from "@nestjs/common";

import { ServiceAuthModule } from "../service-auth.module.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";

/**
 * The `finance` view: four views and six sections behind one controller.
 *
 * `ServiceAuthModule` is imported here rather than only at the root, for the reason
 * `SettlementModule` does it: a test that builds `FinanceModule` on its own still
 * resolves the guard's token provider, so `@UseGuards` cannot fail at resolution for
 * want of one. It is `@Global`, so five modules importing it construct it once.
 *
 * The provider is here because the service reads rows and reads the clock. `DB` and
 * `CLOCK` are both `@Global`, so neither is declared — which also means the view
 * cannot come to exist as a route with nothing behind it: six methods on a controller
 * with no service is a module resolution error, not a section that 500s.
 */
@Module({
  imports: [ServiceAuthModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
