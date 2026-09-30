import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "../envelope.js";
import { API_V1_PREFIX } from "../prefix.js";
import { ECONOMY } from "../records/index.js";
import { ServiceTokenGuard } from "../service-token.guard.js";

/**
 * `api/v1/economic`.
 *
 * The one view that is not a list.
 *
 * `economic` has four shapes to deliver — the figures, the series behind the
 * chart, the pie's slices, and the per-section figures the rail shows — so its
 * `data` is an object. It is also a view with no group vocabulary, and the
 * envelope's `groups` says so rather than carrying a list nobody reads.
 *
 * The return type is `ConsolePayload["economic"]`, so a record field renamed in
 * the shared contract is a build failure here rather than an `undefined` in a
 * panel. The route is spelled with `API_V1_PREFIX` because a controller's
 * decorator is the only place a path segment is registered, and the browser's
 * copy of the same segment is `consolePath` in the contract — which the e2e test
 * holds the two together by asserting each of these answers at the path the
 * contract builds.
 */
@Controller(`${API_V1_PREFIX}/economic`)
@UseGuards(ServiceTokenGuard)
export class EconomicController {
  @Get()
  economic(): ConsolePayload["economic"] {
    return envelope(ECONOMY, []);
  }
}
