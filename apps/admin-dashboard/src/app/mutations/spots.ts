"use client";

import type { SpotCreate, SpotPatch, SpotRecord, SpotWrite } from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing a price observation.
 *
 * Three verbs, and the second one has no id. A spot's key is `(pool, observedAt)` and
 * its id is generated, so `PUT` goes to the collection and the upsert is decided by
 * the observation's own time. Correcting a price is therefore the same request as
 * recording it, which is the honest shape for a number a sampler produced.
 */
export type { SpotCreate, SpotPatch, SpotRecord, SpotWrite };

/**
 * `POST`: a new spot the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createSpot(body: SpotCreate): Promise<WriteResult<SpotRecord>> {
  return writeResource<SpotRecord>("spots", "POST", body);
}

/**
 * `PUT`: write the observation, inserting it if that `(pool, observedAt)` is new.
 *
 * On the collection rather than behind an id, because a spot's id is generated and
 * there is nothing to address: the natural key is what makes it the same spot. The
 * reason is in `writes.ts`.
 */
export function upsertSpot(body: SpotWrite): Promise<WriteResult<SpotRecord>> {
  return writeResource<SpotRecord>("spots", "PUT", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchSpot(id: string, body: SpotPatch): Promise<WriteResult<SpotRecord>> {
  return writeResource<SpotRecord>("spots", "PATCH", body, id);
}
