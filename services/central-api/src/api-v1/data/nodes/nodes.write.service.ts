import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { InfrastructureNode, NodeCreate, NodePatch, NodeWrite } from "@hewa/console-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { infrastructureNodes } from "../../../db/schema.js";
import { nodeRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, deleted, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * The columns a create or a replace sets.
 *
 * `observedAt` is the one conversion — an ISO string in the contract, a `timestamp`
 * in the column — and it happens once for all four verbs so a patch that moves it
 * and a replace that sets it cannot drift.
 */
function nodeColumns(write: NodeWrite): Omit<typeof infrastructureNodes.$inferInsert, "id"> {
  return {
    name: write.name,
    kind: write.kind,
    provider: write.provider,
    city: write.city,
    country: write.country,
    lat: write.lat,
    lng: write.lng,
    capacityGbps: write.capacityGbps,
    utilisationBps: write.utilisationBps,
    status: write.status,
    observedAt: new Date(write.observedAt),
  };
}

/**
 * The columns a patch sets, and only those the body mentioned.
 *
 * Which matters more here than on any other table: `observedAt` and `status` are
 * how the infrastructure view says a node is *impaired*, and a form that re-sent
 * them on every save would mark a healthy node degraded the moment somebody corrected
 * its latitude.
 */
function nodePatchColumns(patch: NodePatch): Partial<typeof infrastructureNodes.$inferInsert> {
  return {
    name: patch.name,
    kind: patch.kind,
    provider: patch.provider,
    city: patch.city,
    country: patch.country,
    lat: patch.lat,
    lng: patch.lng,
    capacityGbps: patch.capacityGbps,
    utilisationBps: patch.utilisationBps,
    status: patch.status,
    observedAt: patch.observedAt === undefined ? undefined : new Date(patch.observedAt),
  };
}

/**
 * Create, read, replace, patch **and delete**, for `infrastructure_nodes`.
 *
 * One of the two tables that accept a delete, because a node can stop being true:
 * a data centre is decommissioned, a subsea cable is retired, and the row that
 * described it should go rather than sit in the book as capacity that can be sold.
 *
 * ## Deleting a node deletes its monitors
 *
 * `sla_monitors.node_id` is a foreign key with `on delete cascade`, so removing a
 * node takes every commitment watched on it with it. That is the schema's decision
 * and this route inherits it, but it is worth stating where a caller can read it,
 * because the alternative — refusing the delete while commitments exist — is a
 * policy question and not one this service answers. An operator removing a node is
 * telling us the node is gone, and the commitments watched on it were about that
 * node.
 */
@Injectable()
export class NodesWriteService {
  static readonly RESOURCE = "node";

  constructor(@Inject(DB) private readonly db: Database) {}

  /** `POST /api/v1/data/nodes`. A duplicate id is a 409, not a merge. */
  async create(body: NodeCreate): Promise<InfrastructureNode> {
    const row = inserted(
      await write(NodesWriteService.RESOURCE, () =>
        this.db
          .insert(infrastructureNodes)
          .values({ id: body.id, ...nodeColumns(body) })
          .returning(),
      ),
      NodesWriteService.RESOURCE,
      body.id,
    );
    return nodeRecord(row);
  }

  /** `GET /api/v1/data/nodes/:id`. The one record, or a 404 naming it. */
  async readOne(id: string): Promise<InfrastructureNode> {
    const rows = await this.db
      .select()
      .from(infrastructureNodes)
      .where(eq(infrastructureNodes.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(NodesWriteService.RESOURCE, id);
    }
    return nodeRecord(row);
  }

  /**
   * `PUT /api/v1/data/nodes/:id`.
   *
   * 201 when the node was not there and 200 when it was, read from the row the
   * database returned rather than from a second query that could disagree.
   */
  async upsert(
    id: string,
    body: NodeWrite,
  ): Promise<{ node: InfrastructureNode; created: boolean }> {
    const columns = nodeColumns(body);
    const result = upserted(
      await write(NodesWriteService.RESOURCE, () =>
        this.db
          .insert(infrastructureNodes)
          .values({ id, ...columns })
          .onConflictDoUpdate({ target: infrastructureNodes.id, set: columns })
          .returning({ ...getTableColumns(infrastructureNodes), wasCreated: WAS_CREATED }),
      ),
      NodesWriteService.RESOURCE,
      id,
    );
    return { node: nodeRecord(result), created: result.wasCreated };
  }

  /**
   * `PATCH /api/v1/data/nodes/:id`.
   *
   * 404 when the node is not there, and an empty patch returns the record as it
   * stands — after checking it exists, so an absent node is still a 404.
   */
  async patch(id: string, patch: NodePatch): Promise<InfrastructureNode> {
    const columns = defined(nodePatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    const row = updated(
      await write(NodesWriteService.RESOURCE, () =>
        this.db
          .update(infrastructureNodes)
          .set(columns)
          .where(eq(infrastructureNodes.id, id))
          .returning(),
      ),
      NodesWriteService.RESOURCE,
      id,
    );
    return nodeRecord(row);
  }

  /**
   * `DELETE /api/v1/data/nodes/:id`.
   *
   * `returning` rather than a bare delete, because "deleted" and "there was nothing
   * there" are different answers and the second one is a 404 — the case where an
   * operator pressed delete twice.
   */
  async remove(id: string): Promise<void> {
    deleted(
      await write(NodesWriteService.RESOURCE, () =>
        this.db
          .delete(infrastructureNodes)
          .where(eq(infrastructureNodes.id, id))
          .returning({ id: infrastructureNodes.id }),
      ),
      NodesWriteService.RESOURCE,
      id,
    );
  }
}
