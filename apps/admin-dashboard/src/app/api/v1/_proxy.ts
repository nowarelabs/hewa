import "server-only";

import { consolePath, type ConsoleViewKey } from "@hewa/console-types";
import { ResponseCode, httpStatusFor } from "@hewa/response-codes";

/**
 * The one place in this app that knows central-api exists.
 *
 * The service token is read here, on the server, and nowhere else. The browser
 * never sees it, never sends it, and cannot be made to: every `/api/v1` route
 * handler in this app calls {@link forwardViewRequest}, and the token travels
 * from `process.env` to the outbound `fetch` without passing through a module a
 * client component can import. That is the whole reason this file is a route-handler
 * helper and not a `data/` module.
 *
 * ## Why routes at all
 *
 * A browser that called `http://localhost:4000/api/v1/alerts` directly would need
 * the token, and a token in a browser bundle is a token in the browser: readable
 * in devtools, in a proxy, in a `NEXT_PUBLIC_` value that ships to every visitor.
 * Central-api is the only service that must be unreachable from the client, and
 * the route handlers are what make it unreachable rather than merely discouraged.
 *
 * The path is the same on both hops. The browser asks its own origin for
 * `/api/v1/alerts`; this handler asks `CENTRAL_API_URL` for `/api/v1/alerts` and
 * attaches the token. So the only difference between the two `fetch` calls is the
 * base URL, which the browser does not have and this file reads from the
 * environment.
 *
 * Each view gets its own route file, so adding a view is adding one file. There is
 * deliberately no `[...path]` catch-all that forwards whatever it is handed: a
 * proxy that accepts any path on any method is an open relay with a token
 * attached, and it would keep forwarding routes that were never reviewed. That
 * also means there is nothing here to relay a write — the whole surface is a
 * `GET`, and a `POST` gets Next's own 405 without central-api being asked.
 */

/** Where central-api is, from this app's server. */
function centralApiBaseUrl(): string {
  // `process.env` on the server is read per request, not inlined at build time.
  // A module-scope constant would freeze the value into the build output and a
  // container that starts with a different `CENTRAL_API_URL` would keep talking
  // to the address it was compiled against.
  const url = process.env["CENTRAL_API_URL"];
  return (url ?? "http://localhost:4000").replace(/\/+$/, "");
}

/**
 * The shared secret, or a loud failure.
 *
 * Thrown rather than defaulted. A default here would be a known token in a
 * repository, and the symptom would be a deployed app whose records anyone can
 * write; failing at boot says which variable is missing instead.
 */
function serviceToken(): string {
  const token = process.env["CENTRAL_API_SERVICE_TOKEN"];
  if (token === undefined || token.length === 0) {
    throw new Error(
      "CENTRAL_API_SERVICE_TOKEN is not set. Copy .env.example to .env.local and set it to the same value central-api reads.",
    );
  }
  return token;
}

/**
 * Forward one view's request to central-api and answer the browser with what came
 * back.
 *
 * The status and the JSON body pass through unchanged, so there is exactly one
 * envelope in the system and a panel reads the same shape whether it called this
 * app or the service. What does *not* pass through is the upstream `Headers`: they
 * are rebuilt from scratch, because a response header set by the service is not
 * ours to publish and a future one could carry an internal hostname.
 *
 * A transport failure is a 502 with a code, not a thrown error. An operator
 * looking at a panel should be told central-api is unreachable; they should not be
 * shown a stack trace, and they should not be shown the URL that failed to resolve
 * either.
 */
export async function forwardViewRequest(view: ConsoleViewKey): Promise<Response> {
  const path = consolePath(view);

  let url: string;
  let headers: Headers;
  try {
    url = `${centralApiBaseUrl()}${path}`;
    headers = new Headers({
      accept: "application/json",
      "x-hewa-service-token": serviceToken(),
    });
  } catch (error) {
    // A configuration problem, not a bad request, and not a 500 that looks like
    // the service failed. The message names the variable because the reader is
    // whoever deployed this and has a `.env` file to fix.
    return errorEnvelope(
      error instanceof Error ? error.message : "central-api is not configured",
      ResponseCode.Internal,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers,
      // Never a cached answer. A record changed in central-api would otherwise be
      // served back from a cache that `fetch` on the server is free to keep, and
      // the operator would watch a change they made not appear.
      cache: "no-store",
    });
  } catch {
    return errorEnvelope(`central-api did not answer GET ${path}`, ResponseCode.DependencyFailure);
  }

  const payload: unknown = await upstream.json().catch(() => null);

  if (payload === null || typeof payload !== "object") {
    // A body that is not a JSON object means something between here and the
    // service is not the service: a proxy's HTML error page, a load balancer's
    // plain text. Relaying it would put that text in a panel as if it were data.
    return errorEnvelope(
      `central-api answered GET ${path} with a body that is not JSON`,
      ResponseCode.DependencyFailure,
    );
  }

  return Response.json(payload, { status: upstream.status });
}

/**
 * A failure this app produced, in the same envelope the service uses.
 *
 * A missing environment variable and an unreachable service both have to be
 * reportable, and a panel that only understands the service's envelope should not
 * need a second shape to render an error.
 */
function errorEnvelope(message: string, code: ResponseCode): Response {
  return Response.json({ code, message }, { status: httpStatusFor(code) });
}
