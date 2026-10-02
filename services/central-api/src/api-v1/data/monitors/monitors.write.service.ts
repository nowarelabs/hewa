import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type {
  MonitorCreate,
  MonitorPatch,
  MonitorWrite,
  SlaCommitment,
  SlaMonitor,
} from "@hewa/console-types";
import { slaState } from "@hewa/marketplace-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { slaMonitors } from "../../../db/schema.js";
import { monitorRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * Four columns out of one commitment, plus the state they imply.
 *
 * The only conversion in this file that is not a timestamp, and the one that matters
 * most. `state` is not in the write payload because the browser must not decide it:
 * `slaState` is the same comparison a settlement run uses to decide whether to issue
 * a credit, so a payload that carried `state` would let a panel say `compliant` about
 * a commitment the next invoice credits. The service computes it on every write that
 * mentions the commitment, which is why this lives next to the four columns rather
 * than in the mapper that reads them back.
 */
function slaColumns(
  sla: SlaCommitment,
): Pick<
  typeof slaMonitors.$inferInsert,
  "targetBps" | "actualBps" | "creditNumerator" | "creditDenominator" | "state"
> {
  return {
    targetBps: sla.targetBps,
    actualBps: sla.actualBps,
    creditNumerator: sla.creditNumerator,
    creditDenominator: sla.creditDenominator,
    state: slaState(sla),
  };
}

/** The columns a create or a replace sets. */
function monitorColumns(write: MonitorWrite): Omit<typeof slaMonitors.$inferInsert, "id"> {
  return {
    account: write.account,
    nodeId: write.nodeId,
    nodeName: write.nodeName,
    provider: write.provider,
    ...slaColumns(write.sla),
    packetLossPpm: write.packetLossPpm,
    latencyP95Ms: write.latencyP95Ms,
    measuredAt: new Date(write.measuredAt),
  };
}

/**
 * The columns a patch sets, and only those the body mentioned.
 *
 * The one place where the patch shape is not a plain field-by-field copy: `sla` is
 * four columns *and* the derived state, so it is spread in one piece — present as a
 * unit or absent as a unit. Splitting it into four optional columns would let a
 * patch change the target while leaving the state describing the old commitment,
 * which is precisely the disagreement this column exists to prevent.
 */
function monitorPatchColumns(patch: MonitorPatch): Partial<typeof slaMonitors.$inferInsert> {
  return {
    account: patch.account,
    nodeId: patch.nodeId,
    nodeName: patch.nodeName,
    provider: patch.provider,
    ...(patch.sla === undefined ? {} : slaColumns(patch.sla)),
    packetLossPpm: patch.packetLossPpm,
    latencyP95Ms: patch.latencyP95Ms,
    measuredAt: patch.measuredAt === undefined ? undefined : new Date(patch.measuredAt),
  };
}

/**
 * Create, read, replace and patch, for `sla_monitors`. No delete.
 *
 * A commitment is not removed; it is written forward as met, at risk or breached. The
 * `state` column is recomputed on every write that carries the commitment, from
 * `slaState` in `@hewa/marketplace-types` — the same function `settlement/runs` and
 * the credit calculation use — so the column can never describe a different
 * commitment from the four numbers beside it.
 *
 * `nodeId` is a foreign key to `infrastructure_nodes`, so a monitor naming a node that
 * does not exist is a 422 rather than a dangling row; see `write-errors.ts`.
 */
@Injectable()
export class MonitorsWriteService {
  static readonly RESOURCE = "sla monitor";

  constructor(@Inject(DB) private readonly db: Database) {}

  /** `POST /api/v1/data/monitors`. A duplicate id is a 409, not a merge. */
  async create(body: MonitorCreate): Promise<SlaMonitor> {
    const row = inserted(
      await write(MonitorsWriteService.RESOURCE, () =>
        this.db
          .insert(slaMonitors)
          .values({ id: body.id, ...monitorColumns(body) })
          .returning(),
      ),
      MonitorsWriteService.RESOURCE,
      body.id,
    );
    return monitorRecord(row);
  }

  /** `GET /api/v1/data/monitors/:id`. The one record, or a 404 naming it. */
  async readOne(id: string): Promise<SlaMonitor> {
    const rows = await this.db.select().from(slaMonitors).where(eq(slaMonitors.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(MonitorsWriteService.RESOURCE, id);
    }
    return monitorRecord(row);
  }

  /** `PUT /api/v1/data/monitors/:id`. 201 when it was not there, 200 when it was. */
  async upsert(id: string, body: MonitorWrite): Promise<{ monitor: SlaMonitor; created: boolean }> {
    const columns = monitorColumns(body);
    const result = upserted(
      await write(MonitorsWriteService.RESOURCE, () =>
        this.db
          .insert(slaMonitors)
          .values({ id, ...columns })
          .onConflictDoUpdate({ target: slaMonitors.id, set: columns })
          .returning({ ...getTableColumns(slaMonitors), wasCreated: WAS_CREATED }),
      ),
      MonitorsWriteService.RESOURCE,
      id,
    );
    return { monitor: monitorRecord(result), created: result.wasCreated };
  }

  /**
   * `PATCH /api/v1/data/monitors/:id`.
   *
   * 404 when the commitment is not there, and an empty patch returns the record as it
   * stands — after checking it exists.
   */
  async patch(id: string, patch: MonitorPatch): Promise<SlaMonitor> {
    const columns = defined(monitorPatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    const row = updated(
      await write(MonitorsWriteService.RESOURCE, () =>
        this.db.update(slaMonitors).set(columns).where(eq(slaMonitors.id, id)).returning(),
      ),
      MonitorsWriteService.RESOURCE,
      id,
    );
    return monitorRecord(row);
  }
}
