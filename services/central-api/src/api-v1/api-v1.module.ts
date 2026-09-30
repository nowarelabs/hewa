import { Module } from "@nestjs/common";

import { AlertsModule } from "./alerts/alerts.module.js";
import { ConflictsModule } from "./conflicts/conflicts.module.js";
import { EconomicModule } from "./economic/economic.module.js";
import { FlightsModule } from "./flights/flights.module.js";
import { OsintModule } from "./osint/osint.module.js";
import { SatellitesModule } from "./satellites/satellites.module.js";
import { ServiceAuthModule } from "./service-auth.module.js";
import { StreamsModule } from "./streams/streams.module.js";

/**
 * Everything under `/api/v1`.
 *
 * The directory is named after the prefix it serves, the way `src/health` is
 * named after `@Controller("health")`, so a route's location is readable from the
 * path in a browser rather than being a naming convention to be remembered.
 *
 * One module per view, aggregated here. Nest has no way to apply a URL prefix to a
 * group of modules — a `RouterModule` path would be a second place the prefix
 * lives, and it is the deprecated one — so each view's controller spells
 * `API_V1_PREFIX` itself and this module's job is to say which views exist at all.
 *
 * That makes this list worth reading against `CONSOLE_VIEWS`. A view added to the
 * contract with no module here has a panel that 404s, and the e2e test walks the
 * contract rather than this list, so it fails there rather than in a browser.
 */
@Module({
  imports: [
    // Provided globally so each view module can resolve the guard's token without
    // declaring it, and listed here because a prefix whose only consumer is a
    // `@Global` module is a dependency that has stopped being visible.
    ServiceAuthModule,
    AlertsModule,
    ConflictsModule,
    EconomicModule,
    FlightsModule,
    OsintModule,
    SatellitesModule,
    StreamsModule,
  ],
})
export class ApiV1Module {}
