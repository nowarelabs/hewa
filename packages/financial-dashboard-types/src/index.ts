/**
 * The financial dashboard's API contract.
 *
 * Three things live here and nothing else: what a record is, the envelope it
 * arrives in, and the columns a caller may write. The records themselves are the
 * service's — they are data, and data belongs behind an endpoint. What belongs in
 * a package both sides can depend on is the shape, so that renaming a field is a
 * build failure in the place that fills it and not an `undefined` on screen.
 *
 * A record is *what the dashboard is about*, and it is not hardcoded here. This
 * dashboard is about the money: what was billed, what is still owed, what was
 * credited back, what has been paid out, whether the book balances, and whether the
 * month's revenue was attested. A record's fields that are amounts, statuses or
 * account types reuse the domain packages rather than re-spelling them —
 * `PayoutStatus` is `@hewa/settlement-domain`'s, `AccountType` is
 * `@hewa/ledger-accounting`'s, and a money literal written twice is two minor-unit
 * conventions that will not both be six decimals.
 *
 * `writes.ts` is the third thing, and it is the one that is not about reading. It is
 * also the one that differs most from `@hewa/console-types`: finance resources get
 * the verbs they have a business accepting and nothing else, and the module comment
 * there is the argument for why.
 *
 * Adding a section is three edits: a record module here, an entry in
 * `FinancePayload` and `FINANCE_SECTIONS`, and a route in the service. A section
 * missing one of them is caught by the service's e2e test and by `tests/data.test.ts`
 * in the app. Adding a writable resource is four: the write interface here, a name
 * in `FINANCE_WRITE_RESOURCES` and its verbs in `FINANCE_WRITE_VERBS`, a controller
 * in the service, and an editor in the app.
 */
export * from "./billing.js";
export * from "./envelope.js";
export * from "./ledger.js";
export * from "./payouts.js";
export * from "./proof.js";
export * from "./sections.js";
export * from "./writes.js";
