import "server-only";

import {
  CONSOLE_SECTIONS,
  type ConsoleSectionId,
  type ConsoleViewKey,
  type ConsoleWriteResource,
} from "@hewa/console-types";
import { ResponseCode, httpStatusFor } from "@hewa/response-codes";

import {
  errorEnvelope,
  forwardSectionRequest,
  forwardWriteRequest,
  isDeletableResource,
  isSectionOf,
  isWritableResource,
} from "./_proxy";

/**
 * The handler a section's route file exports.
 *
 * Exported as a factory rather than written out in each of the sixteen route files
 * so that all sixteen are the same call with a different pair of keys. The
 * interesting part — the token, the upstream URL, the envelope — is written down
 * once, in `_proxy`.
 *
 * ## Why the pair is checked before it is forwarded
 *
 * The segment is a `string` at runtime whatever the route file's directory is
 * called, so the literal type the call site hands over is checked and the value
 * that arrives is not. `isSectionOf` is the check on the value: it asks the
 * contract whether *this* view has *that* section, so a request for
 * `market/outages` — a real section id under the wrong view — is refused here
 * rather than forwarded to a service that will answer 404 having had a valid
 * service token attached to it. This app is the only place that knows both halves
 * of the path, so it is the only place that can catch the mismatch.
 *
 * There is only ever a `GET`. A write verb is not merely unproxied: it is not
 * exported, so Next answers it from its own router with a 405 and central-api is
 * never asked. Registering a `POST` that forwarded would be the first step of a
 * write path, and the service has no write path to forward to.
 */
export function sectionHandlers<TSection extends ConsoleSectionId<ConsoleViewKey>>(
  view: ConsoleViewKey,
  section: TSection,
): { GET: (request: Request) => Promise<Response> } {
  return {
    // `async` rather than returning the two arms directly, because one of them is a
    // promise and the other is not and a union of the two is not a handler.
    GET: async () =>
      isSectionOf(view, section)
        ? await forwardSectionRequest(view, section)
        : Response.json(
            {
              code: ResponseCode.NotFound,
              message: `${view} has no section called ${section}`,
              sections: CONSOLE_SECTIONS[view],
            },
            { status: httpStatusFor(ResponseCode.NotFound) },
          ),
  };
}

/**
 * What Next hands a `[id]` route handler alongside the request.
 *
 * A `Promise` because the framework hands over the params asynchronously; awaiting
 * it here means the id is a `string` by the time anything forwards it, rather than
 * a promise a caller has to remember to resolve before putting it in a path.
 */
export interface RecordContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * The handlers for one writable resource's collection.
 *
 * `POST` only, because that is the only verb a collection answers. An upsert on a
 * spot has no id to address and arrives as a `PUT` on this same path, which is why
 * the spot's collection route exports both and the other five do not.
 *
 * The shape mirrors {@link sectionHandlers}: the route file names a resource, this
 * file checks the name against the contract, and `_proxy` owns the tokens.
 */
export function dataHandlers<TResource extends ConsoleWriteResource>(
  resource: TResource,
): { POST: (request: Request) => Promise<Response> } {
  return {
    POST: async (request: Request) => {
      if (!isWritableResource(resource)) {
        return unknownResource(resource);
      }

      const body = await requestBody(request);
      return body === BAD_BODY ? badBody() : forwardWriteRequest(resource, "POST", null, body);
    },
  };
}

/**
 * The handlers for the one resource that is written on a natural key.
 *
 * `PUT` alongside `POST`, on the same path, because a spot has a generated integer
 * id: there is no id for a `PUT` to address, so the upsert happens on the
 * `(pool, observedAt)` the body carries. Separate from {@link dataHandlers} rather
 * than a flag on it, so that the six route files which have no natural key cannot
 * grow one by accident — the difference is which key makes a spot the same spot.
 */
export function dataNaturalKeyHandlers<TResource extends ConsoleWriteResource>(
  resource: TResource,
): {
  POST: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
} {
  const post = dataHandlers(resource).POST;

  return {
    POST: post,
    PUT: async (request: Request) => {
      if (!isWritableResource(resource)) {
        return unknownResource(resource);
      }

      const body = await requestBody(request);
      return body === BAD_BODY ? badBody() : forwardWriteRequest(resource, "PUT", null, body);
    },
  };
}

/**
 * The handlers for one record of one writable resource.
 *
 * `GET` as well as the three writing verbs, because a panel that has just saved
 * wants the record it saved, and the service already knows how to say it — read
 * through this proxy with this app's envelope, rather than by remembering whatever
 * the write happened to return.
 *
 * `DELETE` is only asked for by the two resources whose contract has a removal, and
 * it answers 404 for any other. Which resources those are is the service's rule, not
 * this app's: a route file that exported a `DELETE` for an alert would be Next
 * registering a verb this app cannot honour, and the answer it produced — a 405 from
 * the framework — says less about the domain than one that says what went wrong.
 */
export function dataRecordHandlers<TResource extends ConsoleWriteResource>(
  resource: TResource,
): {
  GET: (request: Request, context: RecordContext) => Promise<Response>;
  PUT: (request: Request, context: RecordContext) => Promise<Response>;
  PATCH: (request: Request, context: RecordContext) => Promise<Response>;
  DELETE: (request: Request, context: RecordContext) => Promise<Response>;
} {
  return {
    GET: async (_request, context) => onRecord(resource, "GET", context),
    PUT: async (request, context) => onRecord(resource, "PUT", context, request),
    PATCH: async (request, context) => onRecord(resource, "PATCH", context, request),
    DELETE: async (_request, context) => onRecord(resource, "DELETE", context),
  };
}

/**
 * One verb against one record, or the refusal.
 *
 * A single place where the two refusals are decided, because they are different
 * answers and mixing them up is the bug this function exists to prevent: an unknown
 * resource is this app's mistake and never reaches the service, while a `DELETE` the
 * contract does not permit is a correct request for something that does not exist.
 * Both answer 404 because both are "no such record" to a caller, and the message
 * says which of the two it was.
 */
async function onRecord(
  resource: string,
  method: "GET" | "PUT" | "PATCH" | "DELETE",
  context: RecordContext,
  request?: Request,
): Promise<Response> {
  if (!isWritableResource(resource)) {
    return unknownResource(resource);
  }

  if (method === "DELETE" && !isDeletableResource(resource)) {
    return errorEnvelope(`${resource} cannot be deleted`, ResponseCode.NotFound);
  }

  const body = method === "PUT" || method === "PATCH" ? await requestBody(request) : undefined;
  if (body === BAD_BODY) {
    return badBody();
  }

  const { id } = await context.params;

  return forwardWriteRequest(resource, method, id, body);
}

/** The stand-in for a body that could not be read at all. */
const BAD_BODY: unique symbol = Symbol("a body that is not JSON");

/**
 * A body, or {@link BAD_BODY}.
 *
 * A sentinel rather than `undefined`, because `undefined` is also what a request
 * with no body produces and the two want different answers: nothing to send is
 * something the service can be asked about, while text that is not JSON is not.
 *
 * A malformed body is a 400 from here rather than a request the service will
 * refuse. Forwarded, the service's answer would name a rule about a field the
 * caller never sent, because it never got as far as fields — so the message here
 * says the thing the caller can act on, which is that they sent something other
 * than JSON.
 */
async function requestBody(request: Request | undefined): Promise<unknown> {
  if (request === undefined) {
    return undefined;
  }

  try {
    return await request.json();
  } catch {
    return BAD_BODY;
  }
}

/**
 * The answer for a body that was not JSON.
 *
 * `InvalidRequest` and so a 400, rather than `ValidationFailed` and its 422: no
 * field was refused, because no field was ever read. This is the refusal Nest's own
 * body parser makes before a validation pipe runs, and the proxy stands in for that
 * parser here, so it answers the way the service would have.
 */
function badBody(): Response {
  return errorEnvelope("The request body was not JSON", ResponseCode.InvalidRequest);
}

/** The answer for a path segment the contract does not name as writable. */
function unknownResource(resource: string): Response {
  return errorEnvelope(`${resource} is not a writable resource`, ResponseCode.NotFound);
}
