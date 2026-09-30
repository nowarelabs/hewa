import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { envelope } from "../envelope.js";
import { API_V1_PREFIX } from "../prefix.js";
import { STREAMS, STREAM_CHANNELS } from "../records/index.js";
import { ServiceTokenGuard } from "../service-token.guard.js";

/**
 * `api/v1/streams`.
 *
 * Stream records and the channels they are on.
 *
 * The channels are the second vocabulary on the envelope, which is what the
 * browser's bar filters on and what the rail beside the view is curated from.
 * It used to be sent empty, on the reasoning that a stream has no axis but its
 * own outlet — and the outlet is the axis, so the view had a bar that could not
 * act and a rail that named channels the service was not holding.
 *
 * The return type is `ConsolePayload["streams"]`, so a record field renamed in
 * the shared contract is a build failure here rather than an `undefined` in a
 * panel. The route is spelled with `API_V1_PREFIX` because a controller's
 * decorator is the only place a path segment is registered, and the browser's
 * copy of the same segment is `consolePath` in the contract — which the e2e test
 * holds the two together by asserting each of these answers at the path the
 * contract builds.
 */
@Controller(`${API_V1_PREFIX}/streams`)
@UseGuards(ServiceTokenGuard)
export class StreamsController {
  @Get()
  streams(): ConsolePayload["streams"] {
    return envelope(STREAMS, STREAM_CHANNELS);
  }
}
