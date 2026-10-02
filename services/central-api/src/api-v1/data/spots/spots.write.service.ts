import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { SpotCreate, SpotPatch, SpotRecord, SpotWrite } from "@hewa/console-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { marketSpots } from "../../../db/schema.js";
import { assertQuoteCurrency } from "../../quote-currency.js";
import { spotRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * The columns a create, a replace or an upsert sets.
 *
 * One function for all three because all three send a whole `SpotWrite`; there is no
 * `id` in any of them, because `market_spots.id` is generated. Which is the whole
 * difference between this service and the other five, and it is in the columns
 * rather than in the verbs.
 */
function spotColumns(body: SpotWrite): typeof marketSpots.$inferInsert {
  return {
    pool: body.pool,
    priceMinor: body.priceMinor,
    currency: body.currency,
    observedAt: new Date(body.observedAt),
  };
}

/** The columns a patch sets, and only those the body mentioned. */
function spotPatchColumns(patch: SpotPatch): Partial<typeof marketSpots.$inferInsert> {
  return {
    pool: patch.pool,
    priceMinor: patch.priceMinor,
    currency: patch.currency,
    observedAt: patch.observedAt === undefined ? undefined : new Date(patch.observedAt),
  };
}

/**
 * Create, read, patch and upsert, for `market_spots`. No id on the way in, no delete.
 *
 * ## The address of a spot is its natural key
 *
 * Every other resource here is addressed by an id the caller chose, and `PUT /:id`
 * is an upsert on that id. A spot is the exception, because its id is a generated
 * identity and the thing a caller actually knows is *which pool, at which instant*.
 * So:
 *
 * - `POST /api/v1/data/spots` creates an observation and 409s on the unique
 *   `(pool, observedAt)` pair, which is a collision rather than a new point;
 * - `PUT /api/v1/data/spots` has **no id in the path** and upserts on that pair — a
 *   re-filing of a pool at an instant that already exists is a correction of a price,
 *   and the price series cannot hold both;
 * - `PATCH /api/v1/data/spots/:id` addresses the generated integer, because an editor
 *   holding a row from `market/prices` holds the row's id.
 *
 * Moving an observation's pool or instant is therefore a **replace**, not a patch:
 * both are half of the key, so patching either is patching the row's identity. The
 * schema allows it — refusing it would need the stored row, which the request does
 * not have — and PostgreSQL's unique index refuses the result as a 409 when it
 * collides with another row.
 *
 * ## No delete
 *
 * A price series with a point missing draws a line across the gap and reads as
 * "nothing was observed then", which is a claim about the market that nobody made.
 * A wrong point is corrected; see `writes.ts`.
 *
 * ## One currency, checked before the write
 *
 * `market/prices` refuses a price history quoted in two currencies, for the same
 * reason the book does: the payload declares one currency and a chart drawing two on
 * one axis is not a chart. The check belongs here as well, for the same reason and
 * through the same function — see `quote-currency.ts`.
 */
@Injectable()
export class SpotsWriteService {
  static readonly RESOURCE = "spot";

  constructor(@Inject(DB) private readonly db: Database) {}

  /** `POST /api/v1/data/spots`. The id is the column's, and comes back in the record. */
  async create(body: SpotCreate): Promise<SpotRecord> {
    await this.assertQuotedIn(body.currency);
    const row = inserted(
      await write(SpotsWriteService.RESOURCE, () =>
        this.db
          .insert(marketSpots)
          .values(spotColumns(body))
          // The unique index is named rather than left to the primary key: an insert
          // with no conflict target has nothing to match an existing observation on,
          // and would file a second point at the same pool and instant.
          .onConflictDoNothing()
          .returning(),
      ),
      SpotsWriteService.RESOURCE,
      `${body.pool}@${body.observedAt}`,
    );
    return spotRecord(row);
  }

  /** `GET /api/v1/data/spots/:id`, by the generated integer. */
  async readOne(id: number): Promise<SpotRecord> {
    const rows = await this.db.select().from(marketSpots).where(eq(marketSpots.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(SpotsWriteService.RESOURCE, String(id));
    }
    return spotRecord(row);
  }

  /**
   * `PUT /api/v1/data/spots` — an upsert keyed on `(pool, observedAt)`.
   *
   * `set` holds only the price, because the pool and the instant are what the
   * conflict matched on: writing them back to the same values is noise, and it would
   * read as though the key had moved.
   */
  async upsert(body: SpotWrite): Promise<{ spot: SpotRecord; created: boolean }> {
    await this.assertQuotedIn(body.currency);
    const columns = spotColumns(body);
    const result = upserted(
      await write(SpotsWriteService.RESOURCE, () =>
        this.db
          .insert(marketSpots)
          .values(columns)
          .onConflictDoUpdate({
            target: [marketSpots.pool, marketSpots.observedAt],
            set: { priceMinor: columns.priceMinor, currency: columns.currency },
          })
          .returning({ ...getTableColumns(marketSpots), wasCreated: WAS_CREATED }),
      ),
      SpotsWriteService.RESOURCE,
      `${body.pool}@${body.observedAt}`,
    );
    return { spot: spotRecord(result), created: result.wasCreated };
  }

  /**
   * `PATCH /api/v1/data/spots/:id`.
   *
   * 404 when the observation is not there, and an empty patch returns the record as
   * it stands — after checking it exists.
   */
  async patch(id: number, patch: SpotPatch): Promise<SpotRecord> {
    const columns = defined(spotPatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    // Only asked about when the body mentions it, so a one-field edit does not depend
    // on every other row in the table.
    if (patch.currency !== undefined) {
      await this.assertQuotedIn(patch.currency);
    }

    const row = updated(
      await write(SpotsWriteService.RESOURCE, () =>
        this.db.update(marketSpots).set(columns).where(eq(marketSpots.id, id)).returning(),
      ),
      SpotsWriteService.RESOURCE,
      String(id),
    );
    return spotRecord(row);
  }

  /**
   * The currencies already on the price history, deduplicated by the database.
   *
   * `selectDistinct` rather than reading every observation: this runs before every
   * write that sets a currency, and the history is the one table here that grows
   * without a bound — a price series is a row per pool per interval, forever.
   */
  private async assertQuotedIn(currency: SpotWrite["currency"]): Promise<void> {
    const stored = await this.db
      .selectDistinct({ currency: marketSpots.currency })
      .from(marketSpots);
    assertQuoteCurrency(stored, currency, "price history");
  }
}
