import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { NodeKind, NodeStatus, SettlementKind } from "@hewa/console-types";
import type {
  AccountType,
  BillStatus,
  CreditBasis,
  PayoutStatus,
} from "@hewa/financial-dashboard-types";
import { BILL_STATUSES, CREDIT_BASES, PAYOUT_STATUSES } from "@hewa/financial-dashboard-types";
import { MAX_BPS, TRANSACTION_STATUSES, type Currency } from "@hewa/marketplace-types";
import { ACCOUNT_TYPES } from "@hewa/ledger-accounting";

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
 * Where a bill is in its own lifecycle.
 *
 * `void` is here rather than left to a delete, and the reason is that this
 * workspace has no `DELETE` on any finance table: a deleted bill is a month that was
 * never issued. A voided one is a month that was issued and withdrawn, which is a
 * different fact and the only one an auditor can be shown.
 */
export const billStatusEnum = pgEnum("bill_status", [
  "draft",
  "issued",
  "disputed",
  "paid",
  "void",
]);

/**
 * Why a credit was taken off a bill.
 *
 * The column an operator filters `revenue/credits` by, and it is in the schema
 * rather than derived from the note text so the vocabulary exists before any credit
 * has been issued — a filter chip that appears with the first credit is a control
 * that is only sometimes there.
 */
export const creditBasisEnum = pgEnum("credit_basis", ["sla_shortfall", "dispute", "goodwill"]);

/**
 * The payout state machine, as a column.
 *
 * Mirrors `@hewa/settlement-domain`'s `PAYOUT_STATUSES` for the reason
 * `transactionStatusEnum` mirrors `TRANSACTION_STATUSES`, and `tests/schema.test.ts`
 * asserts the two lists are equal.
 *
 * It is a **different** enum from `transactionStatusEnum`, and the difference is not
 * an accident. A settlement line records money that moved, so its status is the
 * transaction's. A payout obligation records money we still owe, and its status is
 * the payout's own — `converting` is a state an obligation has and a transaction
 * does not. Reusing one enum for both would have meant writing `converting` into a
 * column that clearing runs also read, and a clearing run filtering on a state that
 * belongs to a different table's lifecycle.
 */
export const financePayoutStatusEnum = pgEnum("finance_payout_status", [...PAYOUT_STATUSES]);

export const payoutMethodEnum = pgEnum("payout_method", ["bank", "usdc"]);

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

/**
 * The financial dashboard's tables.
 *
 * ## They are not a second copy of `settlements`
 *
 * `settlements` is a ledger of **money that moved**: a clearing run, a per-flow
 * charge, an escrow movement, a payout that was sent — each one a line in a batch,
 * signed, with a `TransactionStatus` that is the transaction's own lifecycle.
 * These tables are about **what we owe and what we have decided**:
 *
 * - `finance_bills` is a month of charging, itemised, and what is still unpaid on it.
 * - `finance_credits` is a decision to charge less, and why.
 * - `finance_payouts` is an *obligation* — a row exists from `pending`, before any
 *   money has moved, and moves through `converting` and `sending`, which are states
 *   a settled transaction has never been in.
 * - `finance_ledger_accounts` / `_entries` / `_postings` are the double-entry book
 *   the other four are reconciled against.
 * - `finance_attestations` is a day's published revenue, and whether its month is
 *   finished.
 *
 * So a `finance_payouts` row and a `settlements` row of kind `payout` are not the
 * same fact twice: the first is what we owe and how far through the rail it is, the
 * second is the movement that happened. An obligation with no movement is what we
 * still owe; a movement with no obligation is a transfer made for another reason.
 * The `finance_payouts.reference` column is the join between them — it names the bill
 * a payout settles — and it is what makes the reconciliation a query rather than an
 * opinion.
 */

/**
 * Bills issued, itemised.
 *
 * The three charges are stored separately and the total is not stored at all,
 * because `netTotal` is their sum and a stored total is a second copy of a rule
 * that `@hewa/billing-domain` already owns. The record mapper rebuilds a
 * `BillBreakdown` from these columns, so the invoice and the screen read the same
 * arithmetic.
 *
 * `settled_minor` is here for `revenue/receivables` only and is read by no other
 * section: what a bill *is* and what it still *owes* are different questions, and
 * putting the payments column on the bill is what lets the second be answered
 * without a payments table that nothing else would use.
 */
export const financeBills = pgTable(
  "finance_bills",
  {
    id: varchar({ length: 64 }).primaryKey(),
    ispId: varchar({ length: 64 }).notNull(),
    ispName: varchar({ length: 160 }).notNull(),
    /** Billing month as `YYYY-MM`, checked below. */
    month: varchar({ length: 7 }).notNull(),
    currency: currencyColumn.notNull(),
    /** The committed capacity the month is billed on. */
    committedMbps: integer().notNull(),
    commitmentChargeMinor: moneyMinor("commitment_charge_minor"),
    overageChargeMinor: moneyMinor("overage_charge_minor"),
    /** A credit, so never positive. See the check. */
    slaCreditMinor: moneyMinor("sla_credit_minor"),
    status: billStatusEnum().notNull(),
    dueAt: timestamp().notNull(),
    /** Non-`null` exactly when the status is `disputed`. See the check. */
    disputeReason: text(),
    issuedAt: timestamp().notNull(),
    /** What has been settled against the bill. Never negative. */
    settledMinor: bigint("settled_minor", { mode: "number" }).notNull().default(0),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finance_bills_status_idx").on(table.status),
    index("finance_bills_isp_idx").on(table.ispId),
    index("finance_bills_month_idx").on(table.month),
    // One bill per ISP per month, which is what makes `revenue/receivables` a
    // per-customer question. Two September bills for one ISP is a billing run that
    // ran twice, and the second would silently double every receivable figure.
    uniqueIndex("finance_bills_isp_month_uniq").on(table.ispId, table.month),
    // `month` is a grouping key and a sort key in two sections, so a `Sept` in it
    // sorts into a group of its own and ages as if it were after December. The
    // database is the only place that sees every write, so it is the only place
    // that can refuse it.
    check("finance_bills_month_format", sql`${table.month} ~ '^[0-9]{4}-[0-9]{2}$'`),
    // A credit is a reduction. `MonthlyBill.slaCredit` is documented as "a negative
    // amount, or zero", so a positive value here would be a charge added by a
    // column named after a credit — and every reader would have to negate it.
    check("finance_bills_sla_credit_lte_zero", sql`${table.slaCreditMinor} <= 0`),
    check("finance_bills_overage_gte_zero", sql`${table.overageChargeMinor} >= 0`),
    check("finance_bills_commitment_gte_zero", sql`${table.commitmentChargeMinor} >= 0`),
    check("finance_bills_committed_mbps_gte_zero", sql`${table.committedMbps} >= 0`),
    check("finance_bills_settled_gte_zero", sql`${table.settledMinor} >= 0`),
    /**
     * A dispute is a reason or it is not a dispute.
     *
     * Both directions in one constraint, and the second half is the one that earns
     * it: a bill that has been settled but still carries the reason it was disputed
     * reads as though the argument were open, when what happened is that it was won.
     * An empty string is not the answer either — it is a row that renders as a
     * dispute with nothing in it.
     */
    check(
      "finance_bills_dispute_reason_iff_disputed",
      sql`(${table.status} = 'disputed') = (${table.disputeReason} is not null)`,
    ),
  ],
);

/**
 * Credits taken off a bill.
 *
 * Three columns and a foreign key: the bill it belongs to, the amount, and why.
 * `ispId`, `ispName`, `month` and `currency` are **not** here — they are the bill's,
 * and a credit that carried its own copy of them is a credit that could name one ISP
 * while pointing at another's bill. The service joins to `finance_bills` to build
 * the record, which is why the query is a join and not a select.
 */
export const financeCredits = pgTable(
  "finance_credits",
  {
    id: varchar({ length: 64 }).primaryKey(),
    /**
     * The bill being credited.
     *
     * No `on delete cascade`: a credit is the record of a decision about a bill, and
     * if the bill went away the decision still happened. Nothing deletes a bill in
     * this workspace — a bad one is `void`ed — so this is a statement of intent
     * rather than a behaviour anyone depends on today.
     */
    billId: varchar({ length: 64 })
      .notNull()
      .references(() => financeBills.id),
    /** Signed and never positive. A credit reduces what is owed. */
    amountMinor: moneyMinor("amount_minor"),
    basis: creditBasisEnum().notNull(),
    /** What the credit was for. Required, so a credit with no note cannot be written. */
    note: text().notNull(),
    recordedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finance_credits_bill_idx").on(table.billId),
    index("finance_credits_basis_idx").on(table.basis),
    // Zero is allowed and negative is required. A credit of nothing is a
    // bookkeeping artefact an operator may genuinely need to record; a credit of
    // positive value is a charge under the wrong name.
    check("finance_credits_amount_lte_zero", sql`${table.amountMinor} <= 0`),
  ],
);

/**
 * Payout obligations: what we owe an ISP, and how far through the rail it is.
 *
 * ## `amount_minor` is positive here
 *
 * `settlements.amount_minor` is signed because it records value that moved, and a
 * payout is money leaving. `PayoutObligation.amount` in `@hewa/settlement-domain` is
 * **positive**, because an obligation is a positive quantity and the sign belongs to
 * the movement that settles it. This column follows the domain rather than the
 * ledger, so a row and the object it models cannot disagree about their sign — and
 * the check below refuses the other convention rather than leaving it to a reader.
 */
export const financePayouts = pgTable(
  "finance_payouts",
  {
    id: varchar({ length: 64 }).primaryKey(),
    ispId: varchar({ length: 64 }).notNull(),
    ispName: varchar({ length: 160 }).notNull(),
    currency: currencyColumn.notNull(),
    /** What is owed. Positive. */
    amountMinor: moneyMinor("amount_minor"),
    /** What it costs to send. Never negative, and a fee on a payout is a smaller payout. */
    feeMinor: moneyMinor("fee_minor"),
    status: financePayoutStatusEnum().notNull(),
    method: payoutMethodEnum().notNull(),
    /** The bill this payout settles. The join back to `finance_bills`. */
    reference: varchar({ length: 96 }).notNull(),
    occurredAt: timestamp().notNull(),
    /** Non-`null` exactly when the status is `failed`. See the check. */
    failureReason: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finance_payouts_status_idx").on(table.status),
    index("finance_payouts_isp_idx").on(table.ispId),
    index("finance_payouts_reference_idx").on(table.reference),
    check("finance_payouts_amount_gt_zero", sql`${table.amountMinor} > 0`),
    check("finance_payouts_fee_gte_zero", sql`${table.feeMinor} >= 0`),
    // The same rule `settlements` follows, and for the same reason: "nothing
    // happened here" and "something happened here and nobody wrote down what" are
    // the same pixels and opposite facts. A retry out of `failed` back to `pending`
    // clears the reason, which is what a retry means.
    check(
      "finance_payouts_failure_reason_iff_failed",
      sql`(${table.status} = 'failed') = (${table.failureReason} is not null)`,
    ),
  ],
);

/**
 * Mirrors `@hewa/ledger-accounting`'s `ACCOUNT_TYPES`, which is `readonly`.
 *
 * `pgEnum` cannot take a readonly array, so the spread is the price of using the
 * package's list as the source of truth. `tests/schema.test.ts` asserts the two are
 * equal, because a type added to one and not the other is an account type the
 * database cannot hold and the domain can produce.
 */
export const accountTypeEnum = pgEnum("account_type", [...ACCOUNT_TYPES]);

/**
 * The chart of accounts.
 *
 * A real table rather than a set of constants in the service, because an account is
 * a thing this workspace will add to and rename, and `ledger-accounting`'s `Account`
 * carries a `normalSide` that is *derived* from `type` by the package's own table.
 * That normal side is never stored here: the service rebuilds an `Account` with
 * `account(...)` and reads `normalSide` off it, so the sign convention for "what a
 * revenue balance means" has exactly one definition in the workspace instead of one
 * per column that stores it.
 */
export const financeLedgerAccounts = pgTable(
  "finance_ledger_accounts",
  {
    id: varchar({ length: 64 }).primaryKey(),
    name: varchar({ length: 160 }).notNull(),
    type: accountTypeEnum().notNull(),
    currency: currencyColumn.notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finance_ledger_accounts_type_idx").on(table.type),
    // An account is identified by its id, and two accounts sharing a name in one
    // currency is a chart with a duplicate row in it — which `indexAccounts` cannot
    // catch, because it indexes by id.
    uniqueIndex("finance_ledger_accounts_name_currency_uniq").on(table.name, table.currency),
  ],
);

/**
 * Journal entries.
 *
 * One row per posting event, holding its reference and description; the amounts are
 * in `finance_ledger_postings`, because a journal entry with its legs in columns
 * would need a column count that depends on the entry.
 *
 * There is no `updatedAt` on this table and that is deliberate rather than an
 * oversight: an entry is not edited. A correction is a second, reversing entry, so
 * a `PATCH` on this table would have nothing legitimate to do and the timestamp would
 * have no second value to hold.
 */
export const financeLedgerEntries = pgTable(
  "finance_ledger_entries",
  {
    id: varchar({ length: 64 }).primaryKey(),
    /** What this entry is for. Unique, so a retry cannot post twice. */
    reference: varchar({ length: 128 }).notNull(),
    description: text().notNull(),
    occurredAt: timestamp().notNull(),
    currency: currencyColumn.notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    // The idempotence key. A settlement pipeline that times out and retries would
    // otherwise post its journal entry twice, and a double-posted accrual is the
    // kind of error a trial balance still foots through.
    uniqueIndex("finance_ledger_entries_reference_uniq").on(table.reference),
    index("finance_ledger_entries_occurred_idx").on(table.occurredAt),
  ],
);

/**
 * One leg of a journal entry.
 *
 * `amount_minor` is **signed**: positive is a debit, negative is a credit, and the
 * sign does not depend on which account is debited. That is `Posting` in
 * `@hewa/ledger-accounting` and `totalsFor` is the rule that reads it — a revenue
 * account is credited with a negative posting and its balance is still positive,
 * because the normal side flips it for display. Storing a sign convention *here* as
 * well would give the ledger two, and only one of them would be right.
 *
 * `entryId` cascades, because a leg without its entry is a row that cannot be read
 * or balanced; `accountId` does not, because an account is not something an entry
 * may take with it.
 */
export const financeLedgerPostings = pgTable(
  "finance_ledger_postings",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    entryId: varchar({ length: 64 })
      .notNull()
      .references(() => financeLedgerEntries.id, { onDelete: "cascade" }),
    accountId: varchar({ length: 64 })
      .notNull()
      .references(() => financeLedgerAccounts.id),
    /** Positive is a debit, negative a credit. Never zero. */
    amountMinor: moneyMinor("amount_minor"),
  },
  (table) => [
    index("finance_ledger_postings_entry_idx").on(table.entryId),
    index("finance_ledger_postings_account_idx").on(table.accountId),
    // A zero posting balances nothing and says nothing. It would survive into every
    // total as a term that is neither a debit nor a credit.
    check("finance_ledger_postings_amount_ne_zero", sql`${table.amountMinor} <> 0`),
  ],
);

/**
 * Published daily revenue, one row per city and day.
 *
 * ## There is no root and no signature column, and that is the schema doing its job
 *
 * A proof of reserves is worth nothing if the thing it is proven over can be
 * rewritten by whoever holds the write token. A `merkle_root` column here would be
 * exactly that: a value a web form could set to agree with the books. The root is
 * signed by `@hewa/revenue-proof-protocol`'s attestation job and verified by the
 * contract, and neither of those is reachable from this table.
 *
 * What is stored is the day's own figures, so the dashboard can show what was
 * published and whether the month is finished — and `gross - costs` is not stored
 * either, for the same reason `finance_bills` has no `net_total_minor`: it is a
 * subtraction, and the mapper does it.
 */
export const financeAttestations = pgTable(
  "finance_attestations",
  {
    id: varchar({ length: 64 }).primaryKey(),
    city: varchar({ length: 96 }).notNull(),
    /** The month as `YYYY-MM`, checked below. */
    month: varchar({ length: 7 }).notNull(),
    /** Day of that month, 1 to 31. Checked below. */
    day: smallint().notNull(),
    currency: currencyColumn.notNull(),
    /** What the city earned that day. */
    grossMinor: moneyMinor("gross_minor"),
    /** What serving it cost. Never negative. */
    costsMinor: moneyMinor("costs_minor"),
    /**
     * When it was signed and published.
     *
     * Not nullable, because a row here *is* a published attestation: the signing job
     * is what writes it, so there is no draft to represent and no second state to
     * filter on.
     */
    publishedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // One day's revenue per city. `(city, day)` alone would collide across years, so
    // the month is in the key and `day` stays a day-of-month a person can type.
    uniqueIndex("finance_attestations_city_month_day_uniq").on(table.city, table.month, table.day),
    index("finance_attestations_month_idx").on(table.month),
    index("finance_attestations_city_idx").on(table.city),
    check("finance_attestations_day_in_range", sql`${table.day} between 1 and 31`),
    check("finance_attestations_month_format", sql`${table.month} ~ '^[0-9]{4}-[0-9]{2}$'`),
    check("finance_attestations_gross_gte_zero", sql`${table.grossMinor} >= 0`),
    check("finance_attestations_costs_gte_zero", sql`${table.costsMinor} >= 0`),
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
  financeBills,
  financeCredits,
  financePayouts,
  financeLedgerAccounts,
  financeLedgerEntries,
  financeLedgerPostings,
  financeAttestations,
};

export type MarketOrderRow = typeof marketOrders.$inferSelect;
export type NewMarketOrder = typeof marketOrders.$inferInsert;
export type MarketSpotRow = typeof marketSpots.$inferSelect;
export type InfrastructureNodeRow = typeof infrastructureNodes.$inferSelect;
export type SettlementRow = typeof settlements.$inferSelect;
export type SlaMonitorRow = typeof slaMonitors.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;
export type FinanceBillRow = typeof financeBills.$inferSelect;
export type FinanceCreditRow = typeof financeCredits.$inferSelect;
export type FinancePayoutRow = typeof financePayouts.$inferSelect;
export type FinanceLedgerAccountRow = typeof financeLedgerAccounts.$inferSelect;
export type FinanceLedgerEntryRow = typeof financeLedgerEntries.$inferSelect;
export type FinanceLedgerPostingRow = typeof financeLedgerPostings.$inferSelect;
export type FinanceAttestationRow = typeof financeAttestations.$inferSelect;

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
  (typeof nodeStatusEnum.enumValues)[number] extends NodeStatus ? true : never,
  (typeof settlementKindEnum.enumValues)[number] extends SettlementKind ? true : never,
  // The finance half, and the reason it matters here is the same as above: a value
  // added to a contract list and not to the column is a value the domain produces
  // and the database refuses, which is a write that fails in production on the first
  // day anybody tries the new state.
  BillStatus extends (typeof billStatusEnum.enumValues)[number] ? true : never,
  CreditBasis extends (typeof creditBasisEnum.enumValues)[number] ? true : never,
  PayoutStatus extends (typeof financePayoutStatusEnum.enumValues)[number] ? true : never,
  AccountType extends (typeof accountTypeEnum.enumValues)[number] ? true : never,
  (typeof billStatusEnum.enumValues)[number] extends BillStatus ? true : never,
  (typeof creditBasisEnum.enumValues)[number] extends CreditBasis ? true : never,
  (typeof financePayoutStatusEnum.enumValues)[number] extends PayoutStatus ? true : never,
  (typeof accountTypeEnum.enumValues)[number] extends AccountType ? true : never,
];

/**
 * The lists the columns were generated from, checked against the contract's own.
 *
 * `_VocabulariesAgree` above says the *types* agree, which is the half that stops a
 * state being added to a contract and forgotten in the column. This says the
 * generated SQL agrees, because `pgEnum` took a spread of the list and a spread is a
 * copy: the type check passes whether the array had five members or six at the point
 * `pgEnum` ran. `tests/schema.test.ts` compares the two at runtime.
 */
export const _VocabulariesWereSpreadFrom = {
  billStatuses: BILL_STATUSES,
  creditBases: CREDIT_BASES,
  payoutStatuses: PAYOUT_STATUSES,
  accountTypes: ACCOUNT_TYPES,
} as const;
