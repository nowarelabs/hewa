import { Inject, Injectable } from "@nestjs/common";
import type {
  ConsoleEnvelope,
  InfrastructureNode,
  NodeHeadroom,
  NodeKind,
  ProviderFootprint,
} from "@hewa/console-types";
import { asc, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { infrastructureNodes, nodeKindEnum } from "../../db/schema.js";
import { envelope } from "../envelope.js";

/**
 * Capacity-weighted utilisation, in basis points.
 *
 * The obvious aggregate for a provider rollup is `avg(utilisation_bps)`, and it is
 * wrong in a way that gets more wrong the more heterogeneous the provider is. A
 * provider running one 10 Gbps node at 10% and one 1,000 Gbps node at 90% is at
 * 89%, and the mean of the two columns says 50% — so the largest node on the
 * largest provider is reported at half its load and an operator deciding where to
 * add capacity is reading a number that was never true of anything.
 *
 * The weighted form is the committed-to-capacity ratio, which is the same figure
 * the nodes section draws per row and therefore the same figure summed. Exact in
 * `numeric` and truncated once, here, rather than per node.
 */
const weightedUtilisation = sql<number>`trunc(
  coalesce(sum(utilisation_bps::numeric * capacity_gbps)
    / nullif(sum(capacity_gbps), 0), 0)
)::int`;

/**
 * Committed capacity, derived from the same utilisation the rollup reports.
 *
 * A named fragment because it is a column expression used in two places — the
 * per-node projection and the provider `sum` — and writing the arithmetic twice is
 * two chances for the headline to stop being the sum of the rows beneath it.
 *
 * Both uses interpolate it as `${committedOf}`. A `sql` template splices a fragment
 * as SQL, so the fragment keeps its own table qualification wherever it lands; the
 * one thing that does not work is naming it into a template as bare text, as
 * `sum(committedOf)` did, which sends the word `committedOf` to the database as
 * though it were a column.
 */
const committedOf = sql<number>`trunc(${infrastructureNodes.utilisationBps}::numeric
  * ${infrastructureNodes.capacityGbps} / 10000)::int`;

@Injectable()
export class InfrastructureService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `infrastructure/nodes`: every node as it stands.
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
  async readNodes(): Promise<ConsoleEnvelope<InfrastructureNode[], NodeKind>> {
    const rows = await this.readRows();

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

  /**
   * `infrastructure/headroom`: how much room each node has left.
   *
   * Sorted by the room that is left, tightest first, because the section answers
   * "where can the next order go" and that is a question about the smallest number
   * on the page. A node at 99% with 100 Gbps free outranks a node at 40% with
   * 2 Gbps free, and sorting by utilisation would say the opposite.
   *
   * `headroomGbps` is computed in SQL from the node's own two columns rather than
   * left for the panel. A panel that computed it would be a second implementation
   * of the same subtraction, and the two would disagree the first time a node's
   * utilisation moved between the query and the render.
   */
  async readHeadroom(): Promise<ConsoleEnvelope<NodeHeadroom[], NodeKind>> {
    const rows = await this.db
      .select({
        nodeId: infrastructureNodes.id,
        name: infrastructureNodes.name,
        kind: infrastructureNodes.kind,
        provider: infrastructureNodes.provider,
        city: infrastructureNodes.city,
        country: infrastructureNodes.country,
        capacityGbps: infrastructureNodes.capacityGbps,
        utilisationBps: infrastructureNodes.utilisationBps,
        committedGbps: committedOf,
        headroomGbps: sql<number>`greatest(
          ${infrastructureNodes.capacityGbps} - trunc(${infrastructureNodes.utilisationBps}::numeric
            * ${infrastructureNodes.capacityGbps} / 10000)::int, 0)`,
        status: infrastructureNodes.status,
        observedAt: infrastructureNodes.observedAt,
      })
      .from(infrastructureNodes)
      // A negative headroom is a node whose stored utilisation exceeds its
      // capacity, which the `CHECK` does not forbid because it would need a second
      // column. Clamped to zero in the query rather than displayed, so the sorted
      // list cannot put an impossible figure first.
      .orderBy(
        sql`greatest(${infrastructureNodes.capacityGbps} - trunc(${infrastructureNodes.utilisationBps}::numeric
          * ${infrastructureNodes.capacityGbps} / 10000)::int, 0)`,
        asc(infrastructureNodes.name),
      );

    const headroom: NodeHeadroom[] = rows.map((row) => ({
      nodeId: row.nodeId,
      name: row.name,
      kind: row.kind,
      provider: row.provider,
      city: row.city,
      country: row.country,
      capacityGbps: row.capacityGbps,
      committedGbps: row.committedGbps,
      headroomGbps: row.headroomGbps,
      utilisationBps: row.utilisationBps,
      status: row.status,
      observedAt: row.observedAt.toISOString(),
    }));

    return envelope(headroom, nodeKindEnum.enumValues as NodeKind[]);
  }

  /**
   * `infrastructure/providers`: who supplies the network.
   *
   * Grouped in the database, because `kinds` and `countries` are lists and
   * assembling them in JavaScript would mean reading every node to answer a
   * question about a dozen providers. `array_agg` with a `distinct` and an `order
   * by` inside it, so two loads of the same data cannot disagree about which
   * countries a provider runs — a list that reorders on refresh is a legend the
   * reader stops trusting.
   *
   * `impaired` counts nodes that are not `operational`, which is the question this
   * section exists for: one provider holding every subsea cable is invisible in a
   * table of nodes and obvious here.
   */
  async readProviders(): Promise<ConsoleEnvelope<ProviderFootprint[], never>> {
    const rows = await this.db
      .select({
        provider: infrastructureNodes.provider,
        nodeCount: sql<number>`count(*)::int`,
        kinds: sql<
          NodeKind[]
        >`array_agg(distinct ${infrastructureNodes.kind}::text order by ${infrastructureNodes.kind}::text)`,
        countries: sql<
          string[]
        >`array_agg(distinct ${infrastructureNodes.country} order by ${infrastructureNodes.country})`,
        capacityGbps: sql<number>`coalesce(sum(${infrastructureNodes.capacityGbps}), 0)::int`,
        committedGbps: sql<number>`coalesce(sum(${committedOf}), 0)::int`,
        utilisationBps: weightedUtilisation,
        impaired: sql<number>`count(*) filter (where ${infrastructureNodes.status} <> 'operational')::int`,
      })
      .from(infrastructureNodes)
      .groupBy(infrastructureNodes.provider)
      // Most committed capacity first: a provider's share of the network is the
      // figure that makes its concentration matter.
      .orderBy(
        sql`sum(${infrastructureNodes.capacityGbps}) desc`,
        asc(infrastructureNodes.provider),
      );

    // No group vocabulary, and the contract says so with `never` rather than an
    // empty array. A provider's chips would filter a rollup by a column that is
    // already one row per provider — every chip would select the single row it was
    // built from.
    return envelope(
      rows.map((row) => ({
        provider: row.provider,
        nodeCount: row.nodeCount,
        kinds: row.kinds,
        countries: row.countries,
        capacityGbps: row.capacityGbps,
        committedGbps: row.committedGbps,
        utilisationBps: row.utilisationBps,
        impaired: row.impaired,
      })),
      [],
    );
  }

  /** One read shared by two sections, so both are answered from the same columns. */
  private readRows(): Promise<
    {
      id: string;
      name: string;
      kind: NodeKind;
      provider: string;
      city: string;
      country: string;
      lat: number;
      lng: number;
      capacityGbps: number;
      utilisationBps: number;
      status: InfrastructureNode["status"];
      observedAt: Date;
    }[]
  > {
    return this.db.select().from(infrastructureNodes).orderBy(asc(infrastructureNodes.name));
  }
}
