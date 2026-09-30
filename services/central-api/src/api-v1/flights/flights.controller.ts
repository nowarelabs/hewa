import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "../envelope.js";
import { API_V1_PREFIX } from "../prefix.js";
import { FLIGHTS, CARRIERS } from "../records/index.js";
import { ServiceTokenGuard } from "../service-token.guard.js";

/**
 * `api/v1/flights`.
 *
 * Flight records and the carriers they belong to.
 *
 * The carriers are a *second* vocabulary on the same envelope, which is the
 * part worth reading twice: the bar above the view filters by status while the
 * rail beside it filters by carrier. Deriving carriers from the rows would
 * make the rail's contents depend on which flights happened to be in the
 * response.
 *
 * The return type is `ConsolePayload["flights"]`, so a record field renamed in
 * the shared contract is a build failure here rather than an `undefined` in a
 * panel. The route is spelled with `API_V1_PREFIX` because a controller's
 * decorator is the only place a path segment is registered, and the browser's
 * copy of the same segment is `consolePath` in the contract — which the e2e test
 * holds the two together by asserting each of these answers at the path the
 * contract builds.
 */
@Controller(`${API_V1_PREFIX}/flights`)
@UseGuards(ServiceTokenGuard)
export class FlightsController {
  @Get()
  flights(): ConsolePayload["flights"] {
    return envelope(FLIGHTS, CARRIERS);
  }
}
