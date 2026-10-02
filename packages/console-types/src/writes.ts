/**
 * The console's write contract: what may be created, replaced, patched and
 * deleted, and what may not.
 *
 * Every read shape in this package is a *record* — a row as the console draws it.
 * A write payload is not that. It is the set of columns a caller may set, and the
 * difference is worth spelling out because it decides where a field lives:
 *
 * - **The id is not in the write.** It is in the path, or — on a create — it is
 *   the one column a row's author gets to choose because the row is addressed by
 *   it everywhere else.
 * - **`createdAt` and `updatedAt` are not in the write.** The service stamps
 *   them. A caller that can set them is a caller that can put a record in the
 *   past, and every ordering drawn from them is then a lie.
 * - **A derived column is not in the write.** `market_spots` carries no state to
 *   derive, and `sla_monitors.state` is computed from the basis points by the same
 *   rule a settlement run uses to issue a credit. A write that carried it would
 *   let the browser and the invoice disagree about the same commitment.
 * - **Money is two columns, not a {@link Money}.** A write names `priceMinor`
 *   beside `currency` rather than a `Money` object, because a settlement line has
 *   one currency column and a `Money` per amount is a way for a payload to carry
 *   two of them.
 *
 * Three verbs over one payload, and they are not the same verb:
 *
 * | Verb   | Body                    | Absent row          | Row present          |
 * | ------ | ----------------------- | ------------------- | -------------------- |
 * | create | `*Create`               | 201                 | 409                  |
 * | upsert | `*Write`                | 201                 | 200                  |
 * | patch  | `*Patch`                | 404                 | 200                  |
 *
 * A `*Create` is `*Write & { id }` because the id is the only column a create
 * adds, and a `*Patch` is `Partial<*Write>` because a patch changes only what it
 * mentions. There is no `*Replace` type: a replace sends exactly a `*Write`, and
 * the two are the same document by construction rather than by two lists kept
 * beside each other.
 *
 * ## Why four of the six cannot be deleted
 *
 * `alerts`, `settlements`, `market_spots` and `sla_monitors` are the records the
 * console exists to *be right* about, and an operator correcting one of them
 * corrects it by writing it forward. Deleting a settlement line would delete the
 * fact that money moved; deleting an alert would delete the fact that the network
 * did something wrong. There is no soft-delete column on either table to carry the
 * correction, so a `DELETE` here would be indistinguishable from never having
 * happened.
 *
 * `infrastructure_nodes` and `market_orders` are different: a node decommissioned
 * and an order cancelled are both rows that stop being true, and both are
 * routinely removed. So they are the two tables that accept `DELETE`.
 */
import type { Currency, TransactionStatus } from "@hewa/marketplace-types";
import type { Alert, AlertCategory, AlertSeverity } from "./alerts.js";
import type { InfrastructureNode, NodeKind, NodeStatus } from "./infrastructure.js";
import type { MarketOrder, MarketPool, MarketSide } from "./market.js";
import type { Settlement, SettlementKind } from "./settlement.js";
import type { SlaCommitment, SlaMonitor } from "./slas.js";

/**
 * The six things the console can write.
 *
 * Named after the table rather than after the view, because a view holds several
 * sections and only one of them is the row: `infrastructure` reads nodes, headroom
 * and providers, and only the first is writable. A resource named after the view
 * would promise that headroom can be written, which it cannot, because it is a
 * sum of orders.
 */
export const CONSOLE_WRITE_RESOURCES = [
  "alerts",
  "nodes",
  "orders",
  "spots",
  "settlements",
  "monitors",
] as const;

export type ConsoleWriteResource = (typeof CONSOLE_WRITE_RESOURCES)[number];

/**
 * The resources that accept `DELETE`.
 *
 * A subset of {@link CONSOLE_WRITE_RESOURCES}, and typed as one so a caller that
 * offers a delete control keys off this rather than hardcoding two names beside
 * six — which is the list that goes stale first.
 */
export type DeletableWriteResource = "nodes" | "orders";

/** The resources that accept `DELETE`, at runtime. */
export const DELETABLE_WRITE_RESOURCES: readonly DeletableWriteResource[] = ["nodes", "orders"];

/**
 * The record a write returns, keyed by resource.
 *
 * A write answers with the record it just wrote and nothing else — no envelope,
 * no `{ ok: true }`. The envelope exists to carry `meta.groups` beside a *list*, and
 * a single record has no groups to carry; and `created` is already in the status,
 * since a create answers 201 and a replace or patch answers 200. So the panel reads
 * the same shape it drew before the edit, and a client that renders the response
 * needs to learn nothing about the write to render it.
 *
 * A map rather than a union so a generic editor is typed against
 * `ConsoleWriteRecords[R]` for the resource `R` it was given, and a resource added
 * here without an editor is a type error in the editor's registry rather than an
 * `undefined` on a screen.
 */
export interface ConsoleWriteRecords {
  readonly alerts: Alert;
  readonly nodes: InfrastructureNode;
  readonly orders: MarketOrder;
  readonly spots: SpotRecord;
  readonly settlements: Settlement;
  readonly monitors: SlaMonitor;
}

/**
 * One observation of a pool's price, as a write returns it.
 *
 * `market/prices` reads these as `SpotPoint`s inside a `PriceHistory` and as
 * `MarketQuote`s in its `latest` — both of which are shapes for a chart and a
 * table, and neither of which carries an id. This is the row: an id, a pool, a
 * price and the instant it was observed. It exists because the other two cannot
 * be edited, since neither names which observation they mean.
 */
export interface SpotRecord {
  readonly id: string;
  readonly pool: MarketPool;
  /** Price per Gbps-month, in the currency's smallest unit. */
  readonly priceMinor: number;
  readonly currency: Currency;
  /** An ISO 8601 instant. */
  readonly observedAt: string;
}

/**
 * The prefix each writable resource's ids are written with.
 *
 * The database columns are `varchar(64)` primary keys with no default, so a create
 * names its own row — there is no key generator behind the service, and an operator
 * creating an alert is not going to invent a UUID. The prefix is here because it is a
 * convention rather than a rule: it is what the seed data writes (`ord-0001`,
 * `nod-nbo-01`, `alt-0001`, `stl-0001`, `sla-0001`), so a client that generates an id
 * with it produces a key that reads like the ones already in the table and cannot
 * collide with them by accident.
 *
 * A convention and not a constraint: the schema accepts any 1-64 character string, so
 * a caller who has a better id of its own should use it. This only decides what a
 * console offers in a form when the operator has not brought one.
 */
export const WRITE_ID_PREFIXES: Readonly<Record<ConsoleWriteResource, string>> = {
  alerts: "alt-",
  nodes: "nod-",
  orders: "ord-",
  spots: "spot-",
  settlements: "stl-",
  monitors: "sla-",
};

/**
 * Everything a caller may set on an alert.
 *
 * Every writable column and nothing else: no id, no timestamps, no group name.
 * `entityLabel`, `provider` and `city` are set here rather than joined in, so an
 * alert about an entity that has since been deleted still reads the way it did
 * when it was raised — which is the whole reason an alert carries its subject's
 * name twice.
 */
export interface AlertWrite {
  readonly title: string;
  readonly description: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  readonly entityId: string;
  readonly entityLabel: string;
  readonly provider: string;
  readonly city: string;
  readonly lat: number;
  readonly lng: number;
  readonly impactedGbps: number;
  readonly affectedSlas: number;
  readonly automatedAction: string | null;
  /** ISO 8601. The instant the condition was observed, not the instant it was filed. */
  readonly raisedAt: string;
}

export type AlertCreate = AlertWrite & { readonly id: string };
export type AlertPatch = Partial<AlertWrite>;

/** Everything a caller may set on a node. */
export interface NodeWrite {
  readonly name: string;
  readonly kind: NodeKind;
  readonly provider: string;
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lng: number;
  readonly capacityGbps: number;
  /** Utilisation in basis points, 0 to 10_000. */
  readonly utilisationBps: number;
  readonly status: NodeStatus;
  /** ISO 8601. When utilisation was last measured. */
  readonly observedAt: string;
}

export type NodeCreate = NodeWrite & { readonly id: string };
export type NodePatch = Partial<NodeWrite>;

/**
 * Everything a caller may set on an order.
 *
 * Price as `priceMinor` and `currency` rather than as a `Money`, per the module
 * comment. `burstGbps` is a whole gigabits per second and may not be below
 * `committedGbps` — a burst is what the order may reach *beyond* what it commits
 * to, so an order that commits 40 and bursts 10 is an order whose burst is
 * describing its floor.
 */
export interface OrderWrite {
  readonly pool: MarketPool;
  readonly side: MarketSide;
  readonly provider: string;
  readonly committedGbps: number;
  readonly burstGbps: number;
  /** Price per Gbps-month in the currency's smallest unit. */
  readonly priceMinor: number;
  readonly currency: Currency;
  /** ISO 8601. */
  readonly submittedAt: string;
}

export type OrderCreate = OrderWrite & { readonly id: string };
export type OrderPatch = Partial<OrderWrite>;

/**
 * Everything a caller may set on a spot observation.
 *
 * A spot has no id in the write, unlike every other resource here, because the
 * table's id is generated and its natural key is `(pool, observedAt)`: one pool
 * priced at one instant is one observation, and re-filing the same pool at the
 * same instant is a correction of a price rather than a second observation of it.
 * That pair is also the unique index, so it is what an upsert matches on, and a
 * create that collides with it is a 409 rather than a silently duplicated point.
 */
export interface SpotWrite {
  readonly pool: MarketPool;
  /** Price per Gbps-month in the currency's smallest unit. */
  readonly priceMinor: number;
  readonly currency: Currency;
  /** ISO 8601. Half the natural key, and so half of what an upsert matches on. */
  readonly observedAt: string;
}

/** A create cannot name the id, so it is a `SpotWrite` and the service generates one. */
export type SpotCreate = SpotWrite;
/** A patch is addressed by the generated id in the path. */
export type SpotPatch = Partial<SpotWrite>;

/** Everything a caller may set on a settlement line. */
export interface SettlementWrite {
  readonly batch: string;
  readonly kind: SettlementKind;
  readonly status: TransactionStatus;
  readonly counterparty: string;
  /** Value moved, signed. A credit is negative, by the ledger's convention. */
  readonly amountMinor: number;
  /** What the marketplace took. Never negative. */
  readonly feeMinor: number;
  /** One currency for the line, which is why there is one and not two. */
  readonly currency: Currency;
  /** ISO 8601. */
  readonly occurredAt: string;
  /** `null` when it did move, or has not been tried yet. */
  readonly failureReason: string | null;
}

export type SettlementCreate = SettlementWrite & { readonly id: string };
export type SettlementPatch = Partial<SettlementWrite>;

/**
 * Everything a caller may set on a monitored commitment.
 *
 * The commitment travels as a {@link SlaCommitment} — four integers — rather than
 * as the four loose columns, so a write cannot arrive with a target and no credit
 * rate. `state` is absent on purpose: the service computes it from these basis
 * points with the same rule a settlement run uses to issue a credit, and a payload
 * that carried it would let the browser say `met` about a commitment the invoice
 * says was breached.
 */
export interface MonitorWrite {
  readonly account: string;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly provider: string;
  readonly sla: SlaCommitment;
  /** Parts per million of packets lost, 0 to 1_000_000. */
  readonly packetLossPpm: number;
  /** Whole milliseconds. */
  readonly latencyP95Ms: number;
  /** ISO 8601. When the measurement was taken. */
  readonly measuredAt: string;
}

export type MonitorCreate = MonitorWrite & { readonly id: string };
export type MonitorPatch = Partial<MonitorWrite>;
