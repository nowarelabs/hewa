import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type {
  Settlement,
  SettlementCreate,
  SettlementPatch,
  SettlementWrite,
} from "@hewa/console-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { settlements } from "../../../db/schema.js";
import { settlementRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * The columns a create or a replace sets.
 *
 * One `currency` for the line, and `amountMinor` and `feeMinor` beside it rather than
 * two `Money` objects: a settlement line is one movement of value in one currency, so
 * two currency-bearing amounts would be a way for a payload to disagree with itself.
 * The read model splits them back into `Money`, which is where a currency travels with
 * an amount in several places.
 */
function settlementColumns(write: SettlementWrite): Omit<typeof settlements.$inferInsert, "id"> {
  return {
    batch: write.batch,
    kind: write.kind,
    status: write.status,
    counterparty: write.counterparty,
    amountMinor: write.amountMinor,
    feeMinor: write.feeMinor,
    currency: write.currency,
    occurredAt: new Date(write.occurredAt),
    failureReason: write.failureReason,
  };
}

/**
 * The columns a patch sets, and only those the body mentioned.
 *
 * `status` and `failureReason` are the pair that matters: correcting a settlement
 * means saying it failed and why. An editor that re-sent both on every save would
 * leave a completed line with an empty reason, or mark one failed and drop the
 * sentence an operator had to type.
 */
function settlementPatchColumns(patch: SettlementPatch): Partial<typeof settlements.$inferInsert> {
  return {
    batch: patch.batch,
    kind: patch.kind,
    status: patch.status,
    counterparty: patch.counterparty,
    amountMinor: patch.amountMinor,
    feeMinor: patch.feeMinor,
    currency: patch.currency,
    occurredAt: patch.occurredAt === undefined ? undefined : new Date(patch.occurredAt),
    failureReason: patch.failureReason,
  };
}

/**
 * Create, read, replace and patch, for `settlements`. No delete.
 *
 * The strongest case for the absence, and it is worth saying why rather than only
 * leaving the route out: a settlement line records that money moved. Deleting one
 * deletes the fact, not the mistake — and unlike an alert, there is nowhere to put a
 * correction that keeps the record, because the record *is* the correction target. A
 * line that was booked wrong is fixed by writing it forward, which is what the ledger
 * itself does.
 *
 * Nothing here recomputes a run. `settlement/runs` sums its own lines by
 * `(batch, currency)` on every read, so a write moves a run's gross, fees and net
 * because they were derived rather than stored.
 */
@Injectable()
export class SettlementsWriteService {
  static readonly RESOURCE = "settlement";

  constructor(@Inject(DB) private readonly db: Database) {}

  /** `POST /api/v1/data/settlements`. A duplicate id is a 409, not a merge. */
  async create(body: SettlementCreate): Promise<Settlement> {
    const row = inserted(
      await write(SettlementsWriteService.RESOURCE, () =>
        this.db
          .insert(settlements)
          .values({ id: body.id, ...settlementColumns(body) })
          .returning(),
      ),
      SettlementsWriteService.RESOURCE,
      body.id,
    );
    return settlementRecord(row);
  }

  /** `GET /api/v1/data/settlements/:id`. The one record, or a 404 naming it. */
  async readOne(id: string): Promise<Settlement> {
    const rows = await this.db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(SettlementsWriteService.RESOURCE, id);
    }
    return settlementRecord(row);
  }

  /** `PUT /api/v1/data/settlements/:id`. 201 when it was not there, 200 when it was. */
  async upsert(
    id: string,
    body: SettlementWrite,
  ): Promise<{ settlement: Settlement; created: boolean }> {
    const columns = settlementColumns(body);
    const result = upserted(
      await write(SettlementsWriteService.RESOURCE, () =>
        this.db
          .insert(settlements)
          .values({ id, ...columns })
          .onConflictDoUpdate({ target: settlements.id, set: columns })
          .returning({ ...getTableColumns(settlements), wasCreated: WAS_CREATED }),
      ),
      SettlementsWriteService.RESOURCE,
      id,
    );
    return { settlement: settlementRecord(result), created: result.wasCreated };
  }

  /** `PATCH /api/v1/data/settlements/:id`. 404 when the line is not there. */
  async patch(id: string, patch: SettlementPatch): Promise<Settlement> {
    const columns = defined(settlementPatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    const row = updated(
      await write(SettlementsWriteService.RESOURCE, () =>
        this.db.update(settlements).set(columns).where(eq(settlements.id, id)).returning(),
      ),
      SettlementsWriteService.RESOURCE,
      id,
    );
    return settlementRecord(row);
  }
}
