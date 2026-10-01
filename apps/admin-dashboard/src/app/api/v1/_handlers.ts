import "server-only";

import { CONSOLE_SECTIONS, type ConsoleSectionId, type ConsoleViewKey } from "@hewa/console-types";
import { ResponseCode, httpStatusFor } from "@hewa/response-codes";

import { forwardSectionRequest, isSectionOf } from "./_proxy";

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
