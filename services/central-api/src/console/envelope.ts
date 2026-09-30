import { ResponseCode } from "@hewa/response-codes";
import type { ConsoleEnvelope } from "@hewa/console-types";

/**
 * Wrap a view's rows in the console's response envelope.
 *
 * The one place an envelope is built, for the same reason there is one place a
 * path is built: an envelope written out at each of seven handlers is seven
 * chances to answer `{ code, data }` and leave `meta` off, and the client is the
 * only thing that would find out.
 *
 * `groups` is the view's vocabulary, not a count of the rows. It is required even
 * by a view that groups by nothing, so that adding a second group to a view is a
 * change to its records rather than a change to this signature.
 */
export function envelope<TData, TGroup extends string>(
  data: TData,
  groups: TGroup[],
): ConsoleEnvelope<TData, TGroup> {
  return { code: ResponseCode.Ok, data, meta: { groups } };
}
