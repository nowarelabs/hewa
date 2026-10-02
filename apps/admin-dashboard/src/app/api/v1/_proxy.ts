import "server-only";

import {
  CONSOLE_SECTIONS,
  CONSOLE_WRITE_RESOURCES,
  consoleSectionPath,
  DELETABLE_WRITE_RESOURCES,
  type ConsoleSectionId,
  type ConsoleViewKey,
  type ConsoleWriteResource,
  type DeletableWriteResource,
} from "@hewa/console-types";
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
 * `/api/v1/alerts/outages`; this handler asks `CENTRAL_API_URL` for the same path
 * and attaches the token. So the only difference between the two `fetch` calls is
 * the base URL, which the browser does not have and this file reads from the
 * environment.
 *
 * ## Why there is a route file per section
 *
 * Sixteen of them, one per destination, and there is deliberately no `[...path]`
 * catch-all that forwards whatever it is handed. A proxy that accepts any path on
 * any method is an open relay with a token attached, and it would keep forwarding
 * routes that were never reviewed. A concrete route file per section is a list of
 * the paths this app is allowed to ask for, written out and diffable — adding a
 * destination to the contract means adding a file here, and a file here that names
 * a section the contract does not have is a compile error rather than a route that
 * quietly 404s upstream.
 *
 * That also means there is nothing here to relay a write — the whole surface is a
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
 * Forward one section's request to central-api and answer the browser with what
 * came back.
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
export async function forwardSectionRequest<TSection extends ConsoleSectionId<ConsoleViewKey>>(
  view: ConsoleViewKey,
  section: TSection,
): Promise<Response> {
  const path = consoleSectionPath(view, section);

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
 * Whether a section id is one the contract declares for a view.
 *
 * Checked here rather than left to the type alone, because a route file's segment
 * is a `string` at runtime — TypeScript cannot see the literal `"outages"` in a
 * directory name, so the cast above it is unchecked by construction and this is
 * what makes it safe. It is a `Set` lookup because the answer is whether a value is
 * in a short list, and the list is small enough that a linear scan would also be
 * fine, which is worth saying because the fast version is not obviously the fast one
 * at this size.
 */
export function isSectionOf(view: ConsoleViewKey, section: string): boolean {
  const sections: readonly string[] = CONSOLE_SECTIONS[view];
  return sections.includes(section);
}

/**
 * A failure this app produced, in the same envelope the service uses.
 *
 * A missing environment variable and an unreachable service both have to be
 * reportable, and a panel that only understands the service's envelope should not
 * need a second shape to render an error.
 */
export function errorEnvelope(message: string, code: ResponseCode): Response {
  return Response.json({ code, message }, { status: httpStatusFor(code) });
}

/** Where central-api is, from this app's server. */
export function centralApiUrl(path: string): string {
  return `${centralApiBaseUrl()}${path}`;
}

/**
 * The write credential, or a loud failure.
 *
 * Its own function rather than a flag on {@link serviceToken}, because the two
 * secrets are held by different parties and a caller that asked for both would get
 * one of them back — which is how a read-only deployment ends up configured with a
 * write token it never meant to have. Failing by name says which variable is missing.
 */
export function writeToken(): string {
  const token = process.env["CENTRAL_API_WRITE_TOKEN"];
  if (token === undefined || token.length === 0) {
    throw new Error(
      "CENTRAL_API_WRITE_TOKEN is not set. Copy .env.example to .env.local and set it to the same value central-api reads.",
    );
  }
  return token;
}

/**
 * Forward one write to central-api and answer the browser with what came back.
 *
 * Two tokens go out, because central-api guards a write with both: the read token
 * because this app is already holding the records, and the write token because
 * holding them is not the same permission as changing them.
 *
 * The body is the caller's, unexamined. Validating here would be a second
 * implementation of every rule central-api already enforces, and the two would
 * disagree — a console that accepted what the service refuses is a form that saves
 * and then reports success. The service's own `422` is passed back untouched, with
 * its field paths, so the editor can point at the field rather than at the form.
 *
 * `id` is percent-encoded because it is caller-controlled and lands in a path. The
 * write API's ids are ours, but a `PATCH` to a record whose id contains a slash
 * would otherwise address a different record than the caller named.
 */
export async function forwardWriteRequest(
  resource: ConsoleWriteResource,
  // `GET` is here because the service hangs one read off the same guarded
  // controller: `/api/v1/data/{resource}/{id}` is behind the write token too, so
  // reading one record through this function is not a different privilege.
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  id: string | null,
  body: unknown,
): Promise<Response> {
  //
  // The write token is read first and on its own, because its absence is not a
  // mistake — it is a read-only deployment, which central-api reports as 503 and
  // this app must agree with. A missing *read* token means nothing works here at
  // all, and that stays a 500: it is a broken deployment rather than a deliberate one.
  let write: string;
  try {
    write = writeToken();
  } catch (error) {
    return errorEnvelope(
      error instanceof Error ? error.message : "this deployment is read-only",
      ResponseCode.Unavailable,
    );
  }

  const carriesBody = method !== "GET" && method !== "DELETE";

  let url: string;
  let headers: Headers;
  try {
    const path =
      id === null
        ? `/api/v1/data/${resource}`
        : // Encoded, because the id is a path segment from a URL and not a value from
          // a form: an unencoded `../admin` would leave `/api/v1/data/orders/` and
          // arrive as a request to a path this proxy never meant to make.
          `/api/v1/data/${resource}/${encodeURIComponent(id)}`;
    url = centralApiUrl(path);
    headers = new Headers({
      accept: "application/json",
      "x-hewa-service-token": serviceToken(),
      "x-hewa-write-token": write,
    });

    //
    // Declared only when there is a payload, and never optional. `fetch` will send
    // these bytes without being asked, but Nest's body parser decides what to do
    // with them by the header rather than by sniffing: a body with no declared
    // `content-type` is left unparsed, the validation schema then sees `undefined`
    // where an object should be, and the refusal names no field at all — "expected
    // object, received undefined" at the root, which reads to the caller as if it
    // had sent nothing at all. Declaring JSON on a `GET` would be the mirror of
    // that lie: a promise of a payload there is none.
    if (carriesBody) {
      headers.set("content-type", "application/json");
    }
  } catch (error) {
    return errorEnvelope(
      error instanceof Error ? error.message : "central-api is not configured",
      ResponseCode.Internal,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      // `POST`/`PUT`/`PATCH` carry the caller's body verbatim; the other two carry
      // none, because there is nothing to say about reading or removing a record.
      ...(carriesBody ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  } catch {
    return errorEnvelope(
      `central-api did not answer ${method} ${url.replace(centralApiBaseUrl(), "")}`,
      ResponseCode.DependencyFailure,
    );
  }

  // A `DELETE` answers 204 with no body at all, and `json()` on that is an error
  // rather than `null`. Forwarded as the bare 204 so the browser's `fetch` sees the
  // same empty answer it would get from the service.
  if (upstream.status === 204) {
    return new Response(null, { status: 204 });
  }

  const payload: unknown = await upstream.json().catch(() => null);

  if (payload === null || typeof payload !== "object") {
    return errorEnvelope(
      `central-api answered ${method} with a body that is not JSON`,
      ResponseCode.DependencyFailure,
    );
  }

  return Response.json(payload, { status: upstream.status });
}

/**
 * Whether a path segment is a resource this app is allowed to write.
 *
 * The write half of {@link isSectionOf}, and for the same reason: a route file's
 * segment is a `string` at runtime, so the cast above it is unchecked by
 * construction and this is what makes it safe. A request for `invoices` is refused
 * here rather than forwarded to a service that would answer 404 having had both
 * tokens attached to it.
 */
export function isWritableResource(resource: string): resource is ConsoleWriteResource {
  const writable: readonly string[] = CONSOLE_WRITE_RESOURCES;
  return writable.includes(resource);
}

/**
 * Whether the contract permits a `DELETE` for this resource.
 *
 * Two of the six have one and four do not, and the reason is in `writes.ts`: an
 * alert and a settlement are facts that happened and a deletion would be a lie
 * about the past. Forwarding the verb anyway would make the difference one that
 * only the service knows about, and this app's route files would claim a capability
 * the domain does not have.
 */
export function isDeletableResource(resource: string): resource is DeletableWriteResource {
  const deletable: readonly string[] = DELETABLE_WRITE_RESOURCES;
  return deletable.includes(resource);
}
