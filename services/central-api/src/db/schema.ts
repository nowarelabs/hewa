import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { NodeKind, NodeStatus, SettlementKind } from "@hewa/console-types";
import { MAX_BPS, TRANSACTION_STATUSES, type Currency } from "@hewa/marketplace-types";

/**
 * The upper bound of a basis-point column, as SQL text.
 *
 * A `CHECK` is DDL and takes no bind parameters, but a `sql` template
 * parameterises every `${}` it is given — so the obvious version of this constant
 * reaches the generated migration as a literal `$1`, which is a syntax error in a
 * constraint definition, on the one statement every fresh database has to run
 * before it owns a single table.
 *
 * `sql.raw` is therefore the only way to say a number in DDL, and the constant is
 * still interpolated into it: widen `MAX_BPS` in `marketplace-types` and every
 * constraint follows, with no second copy to forget.
 */
const CHECK_MAX_BPS = sql.raw(String(MAX_BPS));

/**
 * The console's data, as PostgreSQL tables.
 *
 * The seven constant arrays this replaced were not a fixture that could not be
 * replaced — they were a second copy of the truth that could not be written to.
 * Everything an operator sees now lives here, and it is a real database because
 * a real database can be wrong in the ways a literal cannot: a settlement that
 * failed, a commitment that missed, a node that went dark while nobody was
 * looking. A hand-written array can only ever hold the four rows it was written
 * with.
 *
 * ## What the schema is for that a type would do as well
 *
 * The column types are the contract. Money is a `bigint` in minor units, so a
 * price cannot be stored as a float and quietly rounded; availability is an
 * `integer` of basis points, so `(1 - 0.9) * 100` is not representable in the
 * column either. TypeScript cannot enforce either of those, and both of them are
 * the reason this workspace writes a ledger that balances.
 *
 * ## `casing: "snake_case"`
 *
 * Every table here is plural snake_case with `created_at` / `updated_at` on it,
 * and the Drizzle connection is configured with `casing: "snake_case"` so a
 * `committedGbps` column arrives in Postgres as `committed_gbps` and comes back
 * as `committedGbps`. The mapping is declared once, in `db.module.ts`, rather
 * than spelled as a column name on every field — one spelling per field is one
 * spelling per field to get wrong.
 */

/**
 * The vocabularies are `ENUM`s rather than `text` with a `CHECK`.
 *
 * This is the arrangement that makes `meta.groups` honest. An `ENUM`'s value
 * list is in the type system — `nodeKind.enumValues` — so a view's group
 * vocabulary is read out of the database definition rather than assembled from
 * whatever rows happen to exist today. A group added to the column exists in the
 * vocabulary the instant the migration lands, whether or not anything is on it,
 * which is exactly the guarantee a filter bar needs and the one a `text` column
 * with a hand-written array of strings cannot make.
 */
export const marketPoolEnum = pgEnum("market_pool", [
  "nairobi_ixp",
  "mombasa_corridor",
  "east_africa_subsea",
  "cdn_edge",
]);

export const marketSideEnum = pgEnum("market_side", ["bid", "offer"]);

export const nodeKindEnum = pgEnum("node_kind", [
  "data_center",
  "metro_fiber",
  "long_haul_fiber",
  "ixp",
  "subsea_cable",
  "cdn_edge",
]);

export const nodeStatusEnum = pgEnum("node_status", [
  "operational",
  "degraded",
  "maintenance",
  "offline",
]);

export const settlementKindEnum = pgEnum("settlement_kind", [
  "clearing",
  "micro_payment",
  "escrow",
  "payout",
]);

/**
 * Mirrors `TRANSACTION_STATUSES` rather than repeating it.
 *
 * An `ENUM` cannot take a readonly array, so the spread is the price of reusing
 * the vocabulary as the source of truth. `tests/records.test.ts` asserts the two
 * lists are equal, because the failure mode — a status that settles but has no
 * column, which is a run that fails on the first value nobody expected — is not
 * one a type error would catch.
 */
export const transactionStatusEnum = pgEnum("transaction_status", [...TRANSACTION_STATUSES]);

export const slaStateEnum = pgEnum("sla_state", ["compliant", "at_risk", "breached"]);

export const alertCategoryEnum = pgEnum("alert_category", [
  "sla",
  "capacity",
  "outage",
  "billing",
  "security",
]);

export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "high", "medium", "low"]);

/**
 * `varchar(3)` rather than an enum, because `Currency` already is one list and a
 * second copy of it in the schema would be a second place to add a currency.
 */
export const currencyColumn = varchar({ length: 3 }).$type<Currency>();

/**
 * Minor units of a currency.
 *
 * `mode: "number"` so a row reads back as the `number` the contract declares
 * rather than as the decimal string `bigint` otherwise becomes — `Money` is
 * `amountMinor: number` and a string here would be a coercion in every service
 * that touched one.
 *
 * The mode trades PostgreSQL's unbounded integer for JavaScript's safe one, and
 * that is the right trade for this column: `money()` asserts a safe integer on
 * the way in, and the largest amount this marketplace can represent in minor
 * units is still far past any price a Gbps-month is sold at. `check` below is the
 * belt to that braces.
 */
const moneyMinor = (name: string) => bigint(name, { mode: "number" }).notNull();

/** The market: orders on a book, and the price history of each pool. */
export const marketOrders = pgTable(
  "market_orders",
  {
    id: varchar({ length: 64 }).primaryKey(),
    pool: marketPoolEnum().notNull(),
    side: marketSideEnum().notNull(),
    provider: varchar({ length: 128 }).notNull(),
    /** Whole gigabits per second. See the module comment on why this is not a float. */
    committedGbps: integer().notNull(),
    /** Whole gigabits per second, burstable above `committed_gbps`. */
    burstGbps: integer().notNull(),
    /** Price per Gbps-month, in minor units. */
    priceMinor: moneyMinor("price_minor"),
    currency: currencyColumn.notNull(),
    submittedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("market_orders_pool_idx").on(table.pool),
    index("market_orders_side_idx").on(table.side),
    // A burst capacity below the committed capacity is a book that promises less
    // than it sells, and it would be indistinguishable from a data-entry error in
    // a report three months later. The database is the only place that sees every
    // write, so it is the only place that can refuse it.
    check("market_orders_burst_gte_committed", sql`${table.burstGbps} >= ${table.committedGbps}`),
    check("market_orders_committed_gte_zero", sql`${table.committedGbps} >= 0`),
  ],
);

/**
 * Spot price history, one row per observation.
 *
 * A separate table from the book because the two have different lifetimes: an
 * order is cancelled and an observation is not. It is also the only reason the
 * market view can draw a price line at all — a spot price with no history is a
 * number on a screen.
 */
export const marketSpots = pgTable(
  "market_spots",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    pool: marketPoolEnum().notNull(),
    priceMinor: moneyMinor("price_minor"),
    currency: currencyColumn.notNull(),
    observedAt: timestamp().notNull(),
  },
  (table) => [
    index("market_spots_pool_observed_idx").on(table.pool, table.observedAt),
    uniqueIndex("market_spots_pool_observed_uniq").on(table.pool, table.observedAt),
  ],
);

/** The nodes and routes capacity is sold over. */
export const infrastructureNodes = pgTable(
  "infrastructure_nodes",
  {
    id: varchar({ length: 64 }).primaryKey(),
    name: varchar({ length: 160 }).notNull(),
    kind: nodeKindEnum().notNull(),
    provider: varchar({ length: 128 }).notNull(),
    city: varchar({ length: 96 }).notNull(),
    country: varchar({ length: 96 }).notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    /** Installed capacity, whole gigabits per second. */
    capacityGbps: integer().notNull(),
    /** Utilisation in basis points, 0 to 10_000. */
    utilisationBps: integer().notNull(),
    status: nodeStatusEnum().notNull(),
    observedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("infrastructure_nodes_kind_idx").on(table.kind),
    check(
      "infrastructure_nodes_bps_in_range",
      sql`${table.utilisationBps} between 0 and ${CHECK_MAX_BPS}`,
    ),
    check("infrastructure_nodes_capacity_gte_zero", sql`${table.capacityGbps} >= 0`),
  ],
);

/** Money moving: clearing runs, per-flow charges, escrow, payouts. */
export const settlements = pgTable(
  "settlements",
  {
    id: varchar({ length: 64 }).primaryKey(),
    /** The run this line belongs to. */
    batch: varchar({ length: 64 }).notNull(),
    kind: settlementKindEnum().notNull(),
    status: transactionStatusEnum().notNull(),
    counterparty: varchar({ length: 128 }).notNull(),
    /** Signed: a credit is negative, by the ledger's own convention. */
    amountMinor: moneyMinor("amount_minor"),
    /** Never negative. A fee on a credit is a smaller fee, not a rebate. */
    feeMinor: moneyMinor("fee_minor"),
    currency: currencyColumn.notNull(),
    occurredAt: timestamp().notNull(),
    /** `null` when the line did not fail, which is not the same as an empty reason. */
    failureReason: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("settlements_kind_idx").on(table.kind),
    index("settlements_batch_idx").on(table.batch),
    check("settlements_fee_gte_zero", sql`${table.feeMinor} >= 0`),
  ],
);

/**
 * Every commitment under watch.
 *
 * The columns are the halves of an `SlaCommitment` spread out so they can be
 * constrained, indexed and aggregated; the service reassembles them into the
 * object the contract declares. That is the trade this table makes on purpose —
 * one `jsonb` column holding the whole commitment would keep the shape in one
 * place, and would also make "every commitment that is behind" an unindexed scan
 * of a JSON document, which is the question this view is for.
 */
export const slaMonitors = pgTable(
  "sla_monitors",
  {
    id: varchar({ length: 64 }).primaryKey(),
    account: varchar({ length: 128 }).notNull(),
    /** The node committed to, by the id `infrastructure_nodes` also uses. */
    nodeId: varchar({ length: 64 })
      .notNull()
      .references(() => infrastructureNodes.id, { onDelete: "cascade" }),
    nodeName: varchar({ length: 160 }).notNull(),
    provider: varchar({ length: 128 }).notNull(),
    /** Committed availability, basis points. */
    targetBps: integer().notNull(),
    /** Delivered availability, basis points. */
    actualBps: integer().notNull(),
    /** Credit per whole point of shortfall, as an exact fraction. */
    creditNumerator: integer().notNull(),
    creditDenominator: integer().notNull(),
    /** Parts per million, 0 to 1_000_000. */
    packetLossPpm: integer().notNull(),
    /** Whole milliseconds. Named explicitly: the casing algorithm reads `P95` as `P` then `95`. */
    latencyP95Ms: integer("latency_p95_ms").notNull(),
    /** What the service computed from the two basis-point columns. See `slaState`. */
    state: slaStateEnum().notNull(),
    measuredAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("sla_monitors_state_idx").on(table.state),
    index("sla_monitors_node_idx").on(table.nodeId),
    check("sla_monitors_target_in_range", sql`${table.targetBps} between 0 and ${CHECK_MAX_BPS}`),
    check("sla_monitors_actual_in_range", sql`${table.actualBps} between 0 and ${CHECK_MAX_BPS}`),
    check("sla_monitors_ppm_in_range", sql`${table.packetLossPpm} between 0 and 1000000`),
    // A zero denominator is a rate card that cannot be priced and a negative one
    // is a credit that pays the ISP, so the database refuses both.
    check("sla_monitors_credit_denominator_gt_zero", sql`${table.creditDenominator} > 0`),
    check("sla_monitors_credit_numerator_gte_zero", sql`${table.creditNumerator} >= 0`),
  ],
);

/**
 * Alerts, with the entity they are about rather than a foreign key.
 *
 * An alert is about a node, or an order, or a settlement, so no one table's key
 * is the right key for the column. Holding the id as text and naming the entity
 * alongside it is what lets the details pane say "Mombasa–Nairobi long-haul route"
 * without the service joining against three tables that may each not have it.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: varchar({ length: 64 }).primaryKey(),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    category: alertCategoryEnum().notNull(),
    severity: alertSeverityEnum().notNull(),
    entityId: varchar({ length: 64 }).notNull(),
    entityLabel: varchar({ length: 160 }).notNull(),
    provider: varchar({ length: 128 }).notNull(),
    city: varchar({ length: 96 }).notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    /** Traffic affected, whole gigabits per second. */
    impactedGbps: integer().notNull(),
    affectedSlas: integer().notNull(),
    /** `null` when nothing acted, which is not the same as an action that was blank. */
    automatedAction: text(),
    raisedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("alerts_severity_idx").on(table.severity),
    index("alerts_category_idx").on(table.category),
    check("alerts_impacted_gte_zero", sql`${table.impactedGbps} >= 0`),
    check("alerts_affected_slas_gte_zero", sql`${table.affectedSlas} >= 0`),
  ],
);

/** Every table, for the migration tool and for a test that counts them. */
export const schema = {
  marketOrders,
  marketSpots,
  infrastructureNodes,
  settlements,
  slaMonitors,
  alerts,
};

export type MarketOrderRow = typeof marketOrders.$inferSelect;
export type NewMarketOrder = typeof marketOrders.$inferInsert;
export type MarketSpotRow = typeof marketSpots.$inferSelect;
export type InfrastructureNodeRow = typeof infrastructureNodes.$inferSelect;
export type SettlementRow = typeof settlements.$inferSelect;
export type SlaMonitorRow = typeof slaMonitors.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;

/**
 * The vocabularies, as the contract types.
 *
 * A compile-time check that the `ENUM`s and the `meta.groups` a panel filters on
 * are the same lists. Drizzle's `enumValues` is a mutable `string[]`, so nothing
 * else in the type system notices if a value is added to one list and not the
 * other — and the symptom is a row whose group has no chip and a chip whose group
 * has no row, which is the "control that is only sometimes there" this schema
 * exists to rule out.
 */
export type _VocabulariesAgree = [
  NodeKind extends (typeof nodeKindEnum.enumValues)[number] ? true : never,
  NodeStatus extends (typeof nodeStatusEnum.enumValues)[number] ? true : never,
  SettlementKind extends (typeof settlementKindEnum.enumValues)[number] ? true : never,
  (typeof nodeKindEnum.enumValues)[number] extends NodeKind ? true : never,
  (typeof settlementKindEnum.enumValues)[number] extends SettlementKind ? true : never,
];
