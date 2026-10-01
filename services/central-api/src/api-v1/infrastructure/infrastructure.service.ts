import { Inject, Injectable } from "@nestjs/common";
import { nodeKindEnum, infrastructureNodes } from "../../db/schema.js";
import type { ConsoleEnvelope, InfrastructureNode, NodeKind } from "@hewa/console-types";
import { asc } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { envelope } from "../envelope.js";

@Injectable()
export class InfrastructureService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Every node, newest observation first within a name.
   *
   * The groups come out of `nodeKindEnum.enumValues` — the `ENUM`'s own value list,
   * read from the table definition — rather than out of a `SELECT DISTINCT` over the
   * rows. A distinct query returns the kinds that happen to be occupied today, so a
   * filter bar built from it grows and shrinks chips as the network moves; the
   * contract says a group includes groups no row currently holds, and the `ENUM` is
   * the only thing in the process that knows about a kind nothing is on.
   *
   * `schema.ts` asserts at compile time that this list and `NodeKind` are the same
   * list in both directions, so the cast below cannot hide a value added to one and
   * not the other.
   */
  async read(): Promise<ConsoleEnvelope<InfrastructureNode[], NodeKind>> {
    const rows = await this.db
      .select()
      .from(infrastructureNodes)
      .orderBy(asc(infrastructureNodes.name));

    const nodes: InfrastructureNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      provider: row.provider,
      city: row.city,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      capacityGbps: row.capacityGbps,
      utilisationBps: row.utilisationBps,
      status: row.status,
      observedAt: row.observedAt.toISOString(),
    }));

    return envelope(nodes, nodeKindEnum.enumValues as NodeKind[]);
  }
}
