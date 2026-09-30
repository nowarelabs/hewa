import type { CorsOptionsDelegate } from "@nestjs/common/interfaces/external/cors-options.interface";

import { API_V1_PREFIX } from "../api-v1/prefix.js";

/**
 * The parts of the policy that are the same whichever way the request is answered.
 *
 * `maxAge` is on both paths rather than only the allowed one so that a refused
 * preflight is not re-fetched on every navigation either.
 */
const MAX_AGE_SECONDS = 300;

/**
 * The same prefix, in the form a request URL has it.
 *
 * `API_V1_PREFIX` has no leading slash because a controller's decorator argument
 * is a path segment. A URL starts with one, and `startsWith` would not match
 * without it — so the slash is added here rather than the constant being written
 * twice with two different spellings and a `replace` to reconcile them.
 */
const PREFIXED = `/${API_V1_PREFIX}`;

/**
 * CORS for this service, which is a service and not a website.
 *
 * The whole browser-facing story of `central-api` is one unauthenticated route.
 * Everything under `/api/v1` is reached through the web app's own route handlers,
 * which run server-side and present a service token — a browser has no token to
 * present, so the only browser that can reach a view is one that has already been
 * refused. `/health` is different: a console's status badge and browser-facing
 * probe tooling call it without credentials, so it is a real cross-origin consumer
 * and gets a real allow-list.
 *
 * The exclusion is a second lock rather than the only one. A `curl` ignores CORS
 * entirely, which is the reason the token guard exists and the reason removing CORS
 * from `/api/v1` is not what keeps the data private. What it does do is close the
 * door a browser would otherwise walk up to: with it the preflight is refused, the
 * request is never sent, and the route is not confirmed to exist.
 *
 * The allow-list is configuration rather than a constant, so a second caller is a
 * second entry in `CENTRAL_API_CORS_ORIGINS` and not a deploy of this file.
 */
export function corsDelegate(origins: readonly string[]): CorsOptionsDelegate<{ url: string }> {
  return (request, callback) => {
    callback(
      null,
      request.url.startsWith(PREFIXED)
        ? { origin: false, maxAge: MAX_AGE_SECONDS }
        : { origin: [...origins], maxAge: MAX_AGE_SECONDS },
    );
  };
}
