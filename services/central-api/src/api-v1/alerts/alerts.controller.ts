import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "../envelope.js";
import { API_V1_PREFIX } from "../prefix.js";
import { ALERTS, ALERT_SEVERITIES } from "../records/index.js";
import { ServiceTokenGuard } from "../service-token.guard.js";

/**
 * `api/v1/alerts`.
 *
 * Alert records and the severities that group them.
 *
 * The vocabulary is the list, not the rows. A severity with no alert this week
 * is still offered as a filter, because a filter chip that appears and
 * disappears with the data is a control that is only sometimes there.
 *
 * The return type is `ConsolePayload["alerts"]`, so a record field renamed in
 * the shared contract is a build failure here rather than an `undefined` in a
 * panel. The route is spelled with `API_V1_PREFIX` because a controller's
 * decorator is the only place a path segment is registered, and the browser's
 * copy of the same segment is `consolePath` in the contract — which the e2e test
 * holds the two together by asserting each of these answers at the path the
 * contract builds.
 */
@Controller(`${API_V1_PREFIX}/alerts`)
@UseGuards(ServiceTokenGuard)
export class AlertsController {
  @Get()
  alerts(): ConsolePayload["alerts"] {
    return envelope(ALERTS, ALERT_SEVERITIES);
  }
}
