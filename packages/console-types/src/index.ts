/**
 * The admin console's API contract.
 *
 * Two things live here and nothing else: what a record is, and the envelope it
 * arrives in. The records themselves are the service's — they are data, and data
 * belongs behind an endpoint. What belongs in a package both sides can depend on
 * is the shape, so that renaming a field is a build failure in the place that
 * fills it and not a `undefined` on screen.
 *
 * Adding a view is three edits: a record module here, an entry in `ConsolePayload`
 * and `CONSOLE_VIEWS`, and a route in the service. A view that is missing one of
 * them is caught by the service's e2e test and by `tests/data.test.ts` in the app.
 */
export * from "./alerts.js";
export * from "./conflicts.js";
export * from "./economic.js";
export * from "./envelope.js";
export * from "./flights.js";
export * from "./osint.js";
export * from "./satellites.js";
export * from "./streams.js";
