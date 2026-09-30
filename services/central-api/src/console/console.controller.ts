import { Controller, Get } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "./envelope.js";
import {
  ALERTS,
  ALERT_SEVERITIES,
  CARRIERS,
  ECONOMY,
  FLIGHTS,
  INCIDENTS,
  INCIDENT_KINDS,
  REPORTS,
  REPORT_CATEGORIES,
  SATELLITES,
  SATELLITE_KINDS,
  STREAMS,
} from "./records/index.js";

/**
 * The console's read surface: one endpoint per view.
 *
 * This service fronts every other one, so it is where a browser is allowed to be
 * pointed. Everything under `/console` is a read-only projection of seed records —
 * there is no write path, and adding one is a different module with a different
 * authorisation story, not another handler on this controller.
 *
 * The path of each route is `consolePath(view)` from `@hewa/console-types`, which
 * is also how the console builds its URLs. The routes are written out as literals
 * because Nest registers them by decorator argument, and the e2e test walks
 * `CONSOLE_VIEWS` asserting each one of these answers — so a view with no route,
 * or a route with no view, fails there rather than as a 404 in a browser.
 *
 * Every handler's return type is `ConsolePayload[view]`, so a record field renamed
 * in the shared contract is a build failure here rather than an `undefined` in a
 * panel.
 */
@Controller("console")
export class ConsoleController {
  @Get("alerts")
  alerts(): ConsolePayload["alerts"] {
    return envelope(ALERTS, ALERT_SEVERITIES);
  }

  @Get("conflicts")
  conflicts(): ConsolePayload["conflicts"] {
    return envelope(INCIDENTS, INCIDENT_KINDS);
  }

  /**
   * The one view that is not a list.
   *
   * `economic` has four shapes to deliver — the figures, the series behind the
   * chart, the pie's slices, and the per-section figures the rail shows — so its
   * `data` is an object. It is the only view with no group vocabulary, and the
   * envelope's `groups` says so rather than carrying a list nobody reads.
   */
  @Get("economic")
  economic(): ConsolePayload["economic"] {
    return envelope(ECONOMY, []);
  }

  @Get("flights")
  flights(): ConsolePayload["flights"] {
    return envelope(FLIGHTS, CARRIERS);
  }

  @Get("osint")
  osint(): ConsolePayload["osint"] {
    return envelope(REPORTS, REPORT_CATEGORIES);
  }

  @Get("satellites")
  satellites(): ConsolePayload["satellites"] {
    return envelope(SATELLITES, SATELLITE_KINDS);
  }

  @Get("streams")
  streams(): ConsolePayload["streams"] {
    return envelope(STREAMS, []);
  }
}
