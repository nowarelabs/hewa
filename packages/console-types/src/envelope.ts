import type { ResponseCode } from "@hewa/response-codes";

import type { Alert, AlertSeverity } from "./alerts.js";
import type { Economy } from "./economic.js";
import type { Flight } from "./flights.js";
import type { Incident, IncidentKind } from "./conflicts.js";
import type { Report, ReportCategory } from "./osint.js";
import type { Satellite, SatelliteKind } from "./satellites.js";
import type { Stream, StreamChannel } from "./streams.js";

/**
 * The console's wire contract: one endpoint per view, one envelope for all of them.
 *
 * A response is `{ code, data, meta }`. The `code` is the shared
 * {@link ResponseCode} every surface in this workspace already answers with, so a
 * consumer switches on the same string whether the response came from a Nest
 * service, a Hono process, or a Next route handler. The `data` is the rows.
 * The `meta` is the part that is not rows.
 */

/**
 * What a view knows that is not one of its rows.
 *
 * A named object with one field rather than a bare array, because a view that
 * later needs a total, a cursor or a generated-at stamp adds a key here instead of
 * changing the shape the `data` sits in. That is the whole reason `meta` is an
 * object: a response whose non-row half is a bare value has no room to grow.
 */
export interface ConsoleMeta<TGroup extends string> {
  /**
   * Every group this view can hold, including groups no row currently does.
   *
   * This is a vocabulary, not a count, and it is why it travels with the rows
   * rather than beside them. A summary bar builds a chip per group out of the
   * groups, so a group with nothing in it still gets a chip at zero — and an
   * operator can press it. Derived from the rows alone, a filter chip appears and
   * disappears as the data moves, which is a control that is only sometimes there.
   *
   * Anything found in `data` is counted whether or not it is named here, so this
   * can add groups but can never hide one.
   */
  readonly groups: TGroup[];
}

export interface ConsoleEnvelope<TData, TGroup extends string = never> {
  readonly code: ResponseCode;
  readonly data: TData;
  readonly meta: ConsoleMeta<TGroup>;
}

/**
 * The seven views, in the order the console's tab strip shows them.
 *
 * The runtime list is hand-written and the payload map below is the type, so the
 * two can drift — a view named here with no entry in `ConsolePayload` is an
 * endpoint that answers 404 with a green build. What closes that gap is on the
 * app side: `tests/data.test.ts` asserts this list is the shell config's `views`
 * keys, and the service's e2e test walks this list asserting every one of them
 * routes.
 */
export const CONSOLE_VIEWS = [
  "alerts",
  "conflicts",
  "economic",
  "flights",
  "osint",
  "satellites",
  "streams",
] as const;

export type ConsoleViewKey = (typeof CONSOLE_VIEWS)[number];

/**
 * What each view's endpoint answers with, and the groups its bar can name.
 *
 * `economic` is the one view that groups by nothing — it counts figures rather
 * than rows — so it takes `never`, and a chip built from its groups is a type
 * error rather than an empty bar that renders as if the groups were still
 * loading. `streams` was on that list until its channels became a vocabulary in
 * the same way `flights` carriers already were.
 */
export interface ConsolePayload {
  readonly alerts: ConsoleEnvelope<Alert[], AlertSeverity>;
  readonly conflicts: ConsoleEnvelope<Incident[], IncidentKind>;
  readonly economic: ConsoleEnvelope<Economy, never>;
  readonly flights: ConsoleEnvelope<Flight[], string>;
  readonly osint: ConsoleEnvelope<Report[], ReportCategory>;
  readonly satellites: ConsoleEnvelope<Satellite[], SatelliteKind>;
  readonly streams: ConsoleEnvelope<Stream[], StreamChannel>;
}

export type ConsoleData<K extends ConsoleViewKey> = ConsolePayload[K]["data"];

export type ConsoleGroups<K extends ConsoleViewKey> = ConsolePayload[K]["meta"]["groups"];

/**
 * Where a view's endpoint lives, on both sides of the proxy.
 *
 * Here rather than in either caller because the app builds a URL with it, the
 * proxy builds its upstream URL with it, and the service's tests assert a route
 * against it. A string literal written out in more than one of those is a 404
 * waiting for a rename.
 *
 * The path is the same on both hops, and that is the point. The browser asks its
 * own origin for `/api/v1/alerts`; the Next handler that answers it asks
 * `CENTRAL_API_URL` for `/api/v1/alerts` and attaches the service token. So the
 * one function describes the whole route, and the only difference between the two
 * calls is the base URL — which the browser does not have and the server does.
 */
export function consolePath(view: ConsoleViewKey): string {
  return `/api/v1/${view}`;
}
