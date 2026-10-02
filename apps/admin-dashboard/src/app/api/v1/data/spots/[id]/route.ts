import { dataRecordHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

const handlers = dataRecordHandlers("spots");

export const GET = handlers.GET;

/**
 * No `PUT`, and that is the one place a record route is short a verb.
 *
 * The other five resources are addressed by an id the caller chose, so `PUT` on
 * one replaces the row that id names. A spot is not: `market_spots.id` is a
 * generated identity and the row is found by `(pool, observedAt)`, which is why
 * the upsert lives on the collection instead — `POST` and `PUT` on
 * `../route.ts`, both taking the key in the body. Forwarding `PUT /spots/:id`
 * would put an id in the path that no write could use, and the service answers
 * 404 for a path it does not declare rather than 405 for one it declines.
 */
export const PATCH = handlers.PATCH;
