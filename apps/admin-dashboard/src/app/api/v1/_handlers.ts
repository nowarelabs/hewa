import "server-only";

import type { ConsoleViewKey } from "@hewa/console-types";

import { forwardViewRequest } from "./_proxy";

/**
 * The handler a view's route file exports.
 *
 * Exported as a factory rather than written out in each route file so that all
 * seven routes are the same call with a different key. The interesting part — the
 * token, the upstream URL, the envelope — is written down once, in `_proxy`.
 *
 * There is only ever a `GET`. A write verb is not merely unproxied: it is not
 * exported, so Next answers it from its own router with a 405 and central-api is
 * never asked. Registering a `POST` that forwarded would be the first step of a
 * write path, and the service has no write path to forward to.
 */
export function viewHandlers(view: ConsoleViewKey): {
  GET: (request: Request) => Promise<Response>;
} {
  return { GET: () => forwardViewRequest(view) };
}
