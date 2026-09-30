import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "../envelope.js";
import { API_V1_PREFIX } from "../prefix.js";
import { INCIDENTS, INCIDENT_KINDS } from "../records/index.js";
import { ServiceTokenGuard } from "../service-token.guard.js";

/**
 * `api/v1/conflicts`.
 *
 * Conflict records and the kinds that group them.
 *
 * The console called these incidents once; the contract calls the view
 * `conflicts` and the handler `conflicts`, so nothing in this service has to
 * know what the records were named before the view was.
 *
 * The return type is `ConsolePayload["conflicts"]`, so a record field renamed in
 * the shared contract is a build failure here rather than an `undefined` in a
 * panel. The route is spelled with `API_V1_PREFIX` because a controller's
 * decorator is the only place a path segment is registered, and the browser's
 * copy of the same segment is `consolePath` in the contract — which the e2e test
 * holds the two together by asserting each of these answers at the path the
 * contract builds.
 */
@Controller(`${API_V1_PREFIX}/conflicts`)
@UseGuards(ServiceTokenGuard)
export class ConflictsController {
  @Get()
  conflicts(): ConsolePayload["conflicts"] {
    return envelope(INCIDENTS, INCIDENT_KINDS);
  }
}
