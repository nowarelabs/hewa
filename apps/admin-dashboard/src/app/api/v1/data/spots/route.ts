import { dataNaturalKeyHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = dataNaturalKeyHandlers("spots");

export const POST = handlers.POST;

/**
 * A spot's upsert, on the same path.
 *
 * A spot's id is generated, so `PUT /api/v1/data/spots/:id` would have nothing to
 * address and the upsert happens on the `(pool, observedAt)` the body carries. The
 * reason it lives here rather than behind an id is in `writes.ts`.
 */
export const PUT = handlers.PUT;
