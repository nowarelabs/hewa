import { Module } from "@nestjs/common";

import { AlertsModule } from "./alerts/alerts.module.js";
import { DataWritesModule } from "./data/data-writes.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { MarketModule } from "./market/market.module.js";
import { ServiceAuthModule } from "./service-auth.module.js";
import { SettlementModule } from "./settlement/settlement.module.js";
import { SlasModule } from "./slas/slas.module.js";

/**
 * Everything under `/api/v1`.
 *
 * The directory is named after the prefix it serves, the way `src/health` is named
 * after `@Controller("health")`, so a route's location is readable from the path in a
 * browser rather than being a naming convention to be remembered.
 *
 * One module per view, aggregated here, plus `data/` for the six writable tables.
 * Nest has no way to apply a URL prefix to a group of modules — a `RouterModule` path
 * would be a second place the prefix lives, and it is the deprecated one — so each
 * controller spells `API_V1_PREFIX` itself and this module's job is to say which
 * groups exist at all.
 *
 * Reads and writes are separate modules because they are separate surfaces: the views
 * answer sections of a read-only projection, and `data/` answers records that can be
 * changed. What the split buys is the guard — the write controllers name both tokens
 * and the view controllers name one, so "which routes can change a record" is a
 * question about a directory rather than about every `@UseGuards` in the tree.
 *
 * That list is worth reading against `CONSOLE_VIEWS` and `CONSOLE_WRITE_RESOURCES`. A
 * view added to the contract with no module here has a panel that 404s, and the e2e
 * test walks the contract rather than this list, so it fails there rather than in a
 * browser.
 */
@Module({
  imports: [
    // Provided globally so each view module can resolve the guard's token without
    // declaring it, and listed here because a prefix whose only consumer is a
    // `@Global` module is a dependency that has stopped being visible.
    ServiceAuthModule,
    // Alphabetical, and it happens to be neither the contract's order nor the tab
    // order. Written out rather than built from `CONSOLE_VIEWS`, because a module
    // registry assembled by `map` at import time is a registry whose contents depend
    // on a list imported from another package — and the one list that must stay
    // hand-written here is the list of things Nest can construct.
    AlertsModule,
    DataWritesModule,
    FinanceModule,
    InfrastructureModule,
    MarketModule,
    SettlementModule,
    SlasModule,
  ],
})
export class ApiV1Module {}
