import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { Alert, AlertCreate, AlertPatch, AlertWrite } from "@hewa/console-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { alerts } from "../../../db/schema.js";
import { alertRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * The columns a create or a replace sets.
 *
 * One function rather than spreading the payload into the insert, because `raisedAt`
 * is an ISO string in the contract and a `timestamp` in the column, and that
 * conversion has to happen in one place for all four verbs. Everything else is a
 * rename at most.
 */
function alertColumns(write: AlertWrite): Omit<typeof alerts.$inferInsert, "id"> {
  return {
    title: write.title,
    description: write.description,
    category: write.category,
    severity: write.severity,
    entityId: write.entityId,
    entityLabel: write.entityLabel,
    provider: write.provider,
    city: write.city,
    lat: write.lat,
    lng: write.lng,
    impactedGbps: write.impactedGbps,
    affectedSlas: write.affectedSlas,
    automatedAction: write.automatedAction,
    raisedAt: new Date(write.raisedAt),
  };
}

/**
 * The columns a patch sets, and only those the body mentioned.
 *
 * `Partial` in and `Partial` out, so an omitted field reads as `undefined` and
 * `defined` drops it before the `update`. A patch of `{ severity: "high" }`
 * therefore touches one column rather than fourteen — including `raisedAt`, which
 * re-sending as "now" would silently move an alert to the top of the triage order
 * every time somebody changed its severity.
 */
function alertPatchColumns(patch: AlertPatch): Partial<typeof alerts.$inferInsert> {
  return {
    title: patch.title,
    description: patch.description,
    category: patch.category,
    severity: patch.severity,
    entityId: patch.entityId,
    entityLabel: patch.entityLabel,
    provider: patch.provider,
    city: patch.city,
    lat: patch.lat,
    lng: patch.lng,
    impactedGbps: patch.impactedGbps,
    affectedSlas: patch.affectedSlas,
    automatedAction: patch.automatedAction,
    raisedAt: patch.raisedAt === undefined ? undefined : new Date(patch.raisedAt),
  };
}

/**
 * Create, read, replace and patch, for `alerts`.
 *
 * No `delete`, and the absence is the design rather than an omission: see
 * `writes.ts` in `@hewa/console-types`. An alert records that something went wrong,
 * and removing it removes the evidence rather than the mistake. An operator who
 * raises one by mistake lowers its severity; the console keeps the row.
 *
 * Every verb answers with the **record**, not with the row and not with the body
 * that was sent. The mapper is shared with `AlertsService`, so an edited alert comes
 * back in the same shape the feed drew it in, and an editor renders what landed
 * rather than what it hoped for — the two differ whenever a column has a default.
 */
@Injectable()
export class AlertsWriteService {
  /** The resource as the contract spells it. Every error message here says it. */
  static readonly RESOURCE = "alert";

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `POST /api/v1/data/alerts`.
   *
   * A duplicate id is a 409 and not an upsert: a create asserts "this row is new",
   * and a caller that is wrong about that should be told rather than have its write
   * merged with somebody else's.
   */
  async create(body: AlertCreate): Promise<Alert> {
    const row = inserted(
      await write(AlertsWriteService.RESOURCE, () =>
        this.db
          .insert(alerts)
          .values({ id: body.id, ...alertColumns(body) })
          .returning(),
      ),
      AlertsWriteService.RESOURCE,
      body.id,
    );
    return alertRecord(row);
  }

  /** `GET /api/v1/data/alerts/:id`. The one record, or a 404 naming it. */
  async readOne(id: string): Promise<Alert> {
    const rows = await this.db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(AlertsWriteService.RESOURCE, id);
    }
    return alertRecord(row);
  }

  /**
   * `PUT /api/v1/data/alerts/:id`.
   *
   * The id in the path is the id written. A body carrying a different one is not
   * expressible — the schema rejects `id` outright — so the path is the only
   * statement of which row this is.
   *
   * `getTableColumns` alongside `WAS_CREATED` because `returning` takes a selection
   * rather than a table: without it the statement would return the flag and no
   * columns.
   */
  async upsert(id: string, body: AlertWrite): Promise<{ alert: Alert; created: boolean }> {
    const columns = alertColumns(body);
    const result = upserted(
      await write(AlertsWriteService.RESOURCE, () =>
        this.db
          .insert(alerts)
          .values({ id, ...columns })
          .onConflictDoUpdate({ target: alerts.id, set: columns })
          .returning({ ...getTableColumns(alerts), wasCreated: WAS_CREATED }),
      ),
      AlertsWriteService.RESOURCE,
      id,
    );
    return { alert: alertRecord(result), created: result.wasCreated };
  }

  /**
   * `PATCH /api/v1/data/alerts/:id`.
   *
   * A patch naming a row that is not there is a 404 and not an upsert: a caller
   * that meant to correct a record and named the wrong one has a bug, and quietly
   * inserting a new row turns that bug into a second record that looks right.
   *
   * An empty patch returns the record unchanged rather than refusing. There is
   * nothing to change, and the useful answer to "save this form, which I did not
   * edit" is the record as it stands — after checking it exists, so an absent row is
   * still a 404.
   */
  async patch(id: string, patch: AlertPatch): Promise<Alert> {
    const columns = defined(alertPatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    const row = updated(
      await write(AlertsWriteService.RESOURCE, () =>
        this.db.update(alerts).set(columns).where(eq(alerts.id, id)).returning(),
      ),
      AlertsWriteService.RESOURCE,
      id,
    );
    return alertRecord(row);
  }
}
