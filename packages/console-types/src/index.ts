/**
 * The admin console's API contract.
 *
 * Two things live here and nothing else: what a record is, and the envelope it
 * arrives in. The records themselves are the service's — they are data, and data
 * belongs behind an endpoint. What belongs in a package both sides can depend on
 * is the shape, so that renaming a field is a build failure in the place that
 * fills it and not a `undefined` on screen.
 *
 * A record is *what the console is about*, and it is not hardcoded here. The
 * console administers a bandwidth marketplace, so its views are the market's
 * book, the nodes it trades over, the money moving between them, the commitments
 * behind it, and what the network did wrong. A view's fields that are amounts,
 * rates or availabilities reuse `@hewa/marketplace-types` rather than
 * re-spelling them here — a money literal written twice is two minor-unit
 * conventions, and they will not both be six decimals.
 *
 * Adding a view is three edits: a record module here, an entry in `ConsolePayload`
 * and `CONSOLE_VIEWS`, and a route in the service. A view that is missing one of
 * them is caught by the service's e2e test and by `tests/data.test.ts` in the app.
 */
export * from "./alerts.js";
export * from "./envelope.js";
export * from "./infrastructure.js";
export * from "./market.js";
export * from "./settlement.js";
export * from "./slas.js";
