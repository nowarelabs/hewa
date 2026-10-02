/**
 * Two helpers every write service uses, and nothing else.
 *
 * Six services, four verbs each, and one structural decision: they are written out
 * rather than folded into a generic repository. Drizzle's `insert`/`update`
 * signatures are typed per table, so a generic implementation is either six casts
 * in a row or a `db: any` — and the second is the one that lets a write reach a
 * column that does not exist. Six near-identical services, each one screen long and
 * each naming its own table, is cheaper to read than one abstraction whose type
 * parameters have to be spelled to be trusted.
 *
 * What *is* shared is in this file and in `write-errors.ts`, because these are the
 * facts every one of them would otherwise get right separately:
 *
 * - **`defined`** decides what a patch means. A patch that mentions nothing must
 *   not write `undefined` over a `notNull` column, which in Drizzle means "use the
 *   default" and in PostgreSQL means an error, depending on which column and which
 *   driver. Dropping the absent keys is also what makes `set()` atomic: the update
 *   touches only the columns the caller named.
 * - **`WAS_CREATED`** tells a create from a replace. `PUT` answers 201 when the row
 *   did not exist and 200 when it did, and that difference is the whole observable
 *   contract of an upsert — so it is read from the row rather than guessed from a
 *   second query.
 * - **`inserted`, `updated`, `upserted`** read the three shapes a write comes back
 *   in, and they differ in the *error* rather than in the indexing: an update that
 *   matched nothing is a 404, which is the common case of "the row was deleted
 *   between the list loading and the save".
 */
import { HttpStatus } from "@nestjs/common";
import { ConflictError, NotFoundError } from "@hewa/errors";
import { sql } from "drizzle-orm";
import type { Response } from "express";

/**
 * The keys that are actually set.
 *
 * `undefined` is the marker for "not mentioned", which is why a patch body is
 * `Partial` and a replace body is not: on a replace every key is present, so the
 * two are the same document with a different set of rules rather than the same
 * optional map.
 *
 * `null` survives, and that is the point of it. `automatedAction` and
 * `failureReason` are nullable columns whose `null` means "nothing acted" and "did
 * not fail" — a fact — while an absent key means "leave the column alone". Only
 * one of the two is expressible as `undefined`, and filtering on it keeps both.
 */
export function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/**
 * How Drizzle reports which columns an upsert inserted and which it updated.
 *
 * `xmax` is the transaction id that last modified a row, and it is 0 on a row this
 * transaction inserted. So `xmax = 0` after `on conflict do update` is exactly "this
 * row is new" — which is otherwise a second round trip to find out, and a second
 * round trip that can disagree with the first if the row changes in between.
 *
 * An alternative is `on conflict do nothing` and a re-read, which is one more
 * statement and turns an upsert into a create-or-replace race: two callers writing
 * the same id can both see "created" and one of them is wrong. This is the
 * database telling us, in the same statement that wrote the row.
 *
 * It is PostgreSQL's system column rather than a portable feature, and that is
 * acceptable here because there is no second engine to be portable to — the tests
 * run against PGlite, which is this same database compiled to WebAssembly.
 */
export const WAS_CREATED = sql<boolean>`xmax = 0`;

/**
 * The row an `insert` returned.
 *
 * An insert that returned nothing has not been inserted, so the honest answer is a
 * conflict rather than a server error: the caller believes it created a record, and
 * something else is holding the key. The schema's primary key makes this nearly
 * unreachable — a duplicate id is normally refused by the database first and arrives
 * as a 409 through `translateWriteRefusal` — so this is the second line for a race
 * rather than the first.
 */
export function inserted<TRow>(rows: TRow[], resource: string, id: string): TRow {
  const row = rows[0];
  if (row === undefined) {
    throw new ConflictError(`${resource} "${id}" already exists`);
  }
  return row;
}

/**
 * The row an `update` matched, or a 404.
 *
 * `update … returning` is empty when nothing matched, and "nothing matched" for a
 * patch is the common case of a record that was deleted or moved between the list
 * loading and the save being pressed. Reporting that as a 404 rather than as a
 * success with no record is what lets the panel say "this is gone" instead of
 * leaving a form that will never save.
 */
export function updated<TRow>(rows: TRow[], resource: string, id: string): TRow {
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError(resource, id);
  }
  return row;
}

/**
 * The row an upsert wrote, with the `wasCreated` flag it was selected with.
 *
 * The 404 here is for a statement that matched nothing, which an `insert … on
 * conflict do update` does not do: it either writes a row or refuses. The guard is
 * for the case where the driver hands back no row at all, and it says 404 rather
 * than 500 because a client that is asking "is this there?" wants to be told no.
 */
export function upserted<TRow extends { wasCreated: boolean }>(
  rows: TRow[],
  resource: string,
  id: string,
): TRow {
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError(resource, id);
  }
  return row;
}
/**
 * 201 when an upsert created the row, 200 when it replaced one.
 *
 * Nest's status is fixed before the handler runs and `@HttpCode` is a decorator, so
 * a handler that has to answer 201 sometimes cannot say so in its signature. This is
 * the supported way: `@Res({ passthrough: true })` hands the handler the response
 * without taking over writing to it, so the returned record is still serialised.
 *
 * The two wrong answers are worth naming, because both look fine in review:
 *
 * - `@HttpCode(HttpStatus.CREATED)` on the upsert. A caller that reads 201 knows it
 *   created something, and would then cache a record it actually replaced.
 * - Answering 200 always. "Created" then becomes something the client has to infer
 *   from its own prior state, which is the guess this status exists to avoid.
 */
export function setUpsertStatus(res: Response, created: boolean): void {
  if (created) {
    res.status(HttpStatus.CREATED);
  }
}

/**
 * The row a delete matched, or a 404.
 *
 * `delete … returning` is empty when nothing matched, and that is the case of an
 * operator pressing delete twice — or of two operators pressing it at once, where
 * the second press is not an error but it is not a success either. Answering 404
 * rather than 204 says which of the two happened, and a panel that removes the row
 * from its list can then say so honestly.
 */
export function deleted<TRow>(rows: TRow[], resource: string, id: string): void {
  if (rows.length === 0) {
    throw new NotFoundError(resource, id);
  }
}
