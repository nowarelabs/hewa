/**
 * What a write body may contain, checked by Zod before the service sees it.
 *
 * Three reasons the checks live here rather than in the service or in the panel:
 *
 * - **The service is the boundary.** A body arrives from the network, and every
 *   field below is a value that ends up in a column with a `notNull` and a check
 *   constraint. Validating in the panel would validate one caller.
 * - **The schema is checked against the contract, not beside it.** Every schema is
 *   annotated with the `*Create` / `*Patch` type from `@hewa/console-types`, so a
 *   field renamed in the contract fails *this* build rather than a create that
 *   sends a value nobody reads. The annotation is what makes it a check; without it
 *   a `z.object` that has quietly stopped matching its contract still passes.
 * - **The vocabularies come from the contract's own lists.** `ALERT_SEVERITIES`,
 *   `NODE_KINDS`, `CURRENCIES` and the rest are `readonly` arrays the read paths
 *   filter on, so an enum written out here as a list of literals would be a second
 *   spelling of a vocabulary that already has one. A severity added to the
 *   contract and not here is a create that 422s on a value the panel offers.
 *
 * ## `strictObject` on every body, patch included
 *
 * An unknown key is an error rather than something to ignore. A misspelled field
 * in a form body is silently dropped by a lenient schema, and the operator watches
 * a save succeed, leaves, and finds the value they changed has not moved — with no
 * error anywhere to look at. `partial()` on a strict object keeps the strictness,
 * which is why the patches are derived rather than written out separately.
 *
 * ## What each schema refuses that a `notNull` would not
 *
 * The columns cannot catch all of it and should not be asked to:
 *
 * - **Ranges.** `lat`, `lng`, utilisation, packet loss, latency, committed and
 *   burst gigabits are bounded by what they mean. A latitude of 200 is not a
 *   latitude that a caller may be wrong about; it is a string that went into the
 *   wrong box.
 * - **Money.** Minor units are a safe integer and nothing else. `z.int()` rather
 *   than `z.number().int()`: a `number` that arrived as a float has already lost
 *   the precision no later check can recover.
 * - **Instants.** An ISO 8601 string, because the contract's `instant` fields are
 *   strings and a `Date` would need coercing in every panel that renders one.
 * - **A spot's natural key.** `(pool, observedAt)` is the unique index, so a create
 *   carrying a pair that already exists is a correction rather than a new
 *   observation — and the *upsert* is what performs a correction. See `SpotWrite`.
 */
import {
  ALERT_CATEGORIES,
  ALERT_SEVERITIES,
  MARKET_POOLS,
  MARKET_SIDES,
  NODE_KINDS,
  NODE_STATUSES,
  SETTLEMENT_KINDS,
  type AlertCreate,
  type AlertPatch,
  type AlertWrite,
  type MonitorCreate,
  type MonitorPatch,
  type MonitorWrite,
  type NodeCreate,
  type NodePatch,
  type NodeWrite,
  type OrderCreate,
  type OrderPatch,
  type OrderWrite,
  type SettlementCreate,
  type SettlementPatch,
  type SettlementWrite,
  type SpotCreate,
  type SpotPatch,
  type SpotWrite,
} from "@hewa/console-types";
import { CURRENCIES, MAX_BPS, TRANSACTION_STATUSES } from "@hewa/marketplace-types";
import { z } from "zod";

/** Parts per million of packets lost, 0 to 1_000_000. The column's own ceiling. */
const MAX_PPM = 1_000_000;

/**
 * A row's own key.
 *
 * Length-bounded to the column's `varchar(64)`, so a 200-character id is a 400 at
 * the edge rather than a `value too long` from the driver — which arrives as an
 * exception the error filter opaques into a 500.
 */
const RESOURCE_ID = z.string().min(1).max(64);

/**
 * The id in a path.
 *
 * The same shape as the body's, from one binding: an id that could not be stored
 * cannot be addressed either.
 */
export const RESOURCE_ID_SCHEMA = RESOURCE_ID;

/**
 * A spot's id, which is the one generated key in the console.
 *
 * `market_spots.id` is a `generatedAlwaysAsIdentity` integer, so a spot cannot be
 * addressed by a `varchar` id and a body cannot choose one. The path therefore
 * carries a number, coerced here rather than in the service so that `spots/abc` is a
 * 400 naming the parameter instead of a query that returns nothing.
 *
 * Positive, because PostgreSQL identities start at 1 and a zero or negative id is a
 * row that has never existed.
 */
export const SPOT_ID_SCHEMA = z.coerce.number().int().positive();

/** A human-readable name or title, bounded by its column. */
const label = (max: number) => z.string().min(1).max(max);

/** A sentence with no bound the schema can invent. `text` is unbounded in SQL. */
const sentence = z.string().min(1);

/**
 * An instant as the contract sends it.
 *
 * `z.iso.datetime()` rather than `z.coerce.date()`, because the contract's instant
 * fields are ISO strings and a payload that carries a number of milliseconds is a
 * caller that has picked a representation the record does not use.
 */
const instant = z.iso.datetime();

/** Whole gigabits per second, or a count of things. Never a fraction, never negative. */
const wholeCount = z.int().min(0);

/**
 * Minor units of a currency.
 *
 * `z.int()`, which bounds the value to JavaScript's safe-integer range, so an
 * amount that arrived through a float is refused rather than rounded. See
 * `assertTokenAmount` for the same reasoning on the on-chain side: by the time a
 * figure arrives as a `number` that is not an integer, the precision is gone.
 */
const minorUnits = z.int();

/** Basis points, 0 to 10_000. The same range as `sla_monitors`'s check. */
const bps = z.int().min(0).max(MAX_BPS);

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

/**
 * The four halves of a commitment.
 *
 * Nested rather than four loose columns, so a body cannot carry a target with no
 * credit rate — and so the shape that decides a credit is the shape that travels,
 * which is the whole reason `MonitorWrite` holds an `SlaCommitment`.
 *
 * A non-zero denominator, matching the column's own check: a zero is a rate card
 * that cannot be priced, and refusing it here means the refusal is a 422 naming
 * the field rather than a constraint violation further in.
 */
const slaCommitment = z.strictObject({
  targetBps: bps,
  actualBps: bps,
  creditNumerator: z.int().min(0),
  creditDenominator: z.int().positive(),
});

/** Everything a caller may set on an alert. */
const alertFields = {
  title: label(200),
  description: sentence,
  category: z.enum(ALERT_CATEGORIES),
  severity: z.enum(ALERT_SEVERITIES),
  entityId: RESOURCE_ID,
  entityLabel: label(160),
  provider: label(128),
  city: label(96),
  lat: latitude,
  lng: longitude,
  impactedGbps: wholeCount,
  affectedSlas: wholeCount,
  automatedAction: sentence.nullable(),
  raisedAt: instant,
} satisfies z.ZodRawShape;

/** Everything a caller may set on a node. */
const nodeFields = {
  name: label(160),
  kind: z.enum(NODE_KINDS),
  provider: label(128),
  city: label(96),
  country: label(96),
  lat: latitude,
  lng: longitude,
  capacityGbps: wholeCount,
  utilisationBps: bps,
  status: z.enum(NODE_STATUSES),
  observedAt: instant,
} satisfies z.ZodRawShape;

/**
 * Everything a caller may set on an order.
 *
 * `burstGbps` is bounded below by nothing here and by `committedGbps` only across
 * the two fields, so the pair is refined rather than two independent numbers: see
 * `orderUpsert` below. A schema that could not see the other field would either
 * refuse every order or accept the one the column check exists to refuse.
 */
const orderFields = {
  pool: z.enum(MARKET_POOLS),
  side: z.enum(MARKET_SIDES),
  provider: label(128),
  committedGbps: wholeCount,
  burstGbps: wholeCount,
  priceMinor: minorUnits,
  currency: z.enum(CURRENCIES),
  submittedAt: instant,
} satisfies z.ZodRawShape;

/** Everything a caller may set on a spot observation. No id: the column generates it. */
const spotFields = {
  pool: z.enum(MARKET_POOLS),
  priceMinor: minorUnits,
  currency: z.enum(CURRENCIES),
  observedAt: instant,
} satisfies z.ZodRawShape;

/** Everything a caller may set on a settlement line. */
const settlementFields = {
  batch: label(64),
  kind: z.enum(SETTLEMENT_KINDS),
  status: z.enum(TRANSACTION_STATUSES),
  counterparty: label(128),
  amountMinor: minorUnits,
  feeMinor: z.int().min(0),
  currency: z.enum(CURRENCIES),
  occurredAt: instant,
  failureReason: sentence.nullable(),
} satisfies z.ZodRawShape;

/**
 * Everything a caller may set on a monitored commitment.
 *
 * No `state`. It is computed from `sla` by the service, with the same rule a
 * settlement run uses, so a payload that carried it would let a browser say
 * `compliant` about a commitment the next invoice credits.
 */
const monitorFields = {
  account: label(128),
  nodeId: RESOURCE_ID,
  nodeName: label(160),
  provider: label(128),
  sla: slaCommitment,
  packetLossPpm: wholeCount.max(MAX_PPM),
  latencyP95Ms: wholeCount,
  measuredAt: instant,
} satisfies z.ZodRawShape;

/**
 * An order, with the burst checked against the committed capacity.
 *
 * A named refinement rather than an inline one, because it belongs on both the
 * create and the replace body, and writing it out twice is how the two stop
 * agreeing. The failure names the field rather than the body, because a form with
 * `burstGbps: 10` against `committedGbps: 40` is wrong in a way the operator can
 * act on, and one message for the whole document says less than the field does.
 */
function refuseBurstBelowCommitted(
  order: { committedGbps: number; burstGbps: number },
  ctx: z.RefinementCtx,
): void {
  if (order.burstGbps < order.committedGbps) {
    ctx.addIssue({
      code: "custom",
      path: ["burstGbps"],
      message: "burstGbps may not be below committedGbps",
    });
  }
}

/**
 * The three body shapes per resource.
 *
 * Each base is deliberately **unannotated**: `z.ZodType<T>` is the check that a
 * schema still matches the contract, and annotating the base would erase the object
 * methods the other two are built from. Every *exported* schema is annotated, which
 * is where the check earns its keep — a field added to `AlertWrite` and not to
 * `alertFields` makes one of those assignments fail rather than a create that
 * quietly drops it.
 */
const alertBody = z.strictObject(alertFields);
export const alertUpsertSchema: z.ZodType<AlertWrite> = alertBody;
export const alertCreateSchema: z.ZodType<AlertCreate> = alertBody.extend({ id: RESOURCE_ID });
export const alertPatchSchema: z.ZodType<AlertPatch> = alertBody.partial();

const nodeBody = z.strictObject(nodeFields);
export const nodeUpsertSchema: z.ZodType<NodeWrite> = nodeBody;
export const nodeCreateSchema: z.ZodType<NodeCreate> = nodeBody.extend({ id: RESOURCE_ID });
export const nodePatchSchema: z.ZodType<NodePatch> = nodeBody.partial();

const orderBody = z.strictObject(orderFields).superRefine(refuseBurstBelowCommitted);
export const orderUpsertSchema: z.ZodType<OrderWrite> = orderBody;
export const orderCreateSchema: z.ZodType<OrderCreate> = z
  .strictObject(orderFields)
  .extend({ id: RESOURCE_ID })
  .superRefine(refuseBurstBelowCommitted);
/**
 * A patch cannot refine the pair, because it sets one field and not the other.
 *
 * So the burst and committed rules are not applied here, and the column checks are
 * what refuse a patch that breaks them — see `write-errors.ts` for how that refusal
 * is reported rather than opaqued into a 500.
 */
export const orderPatchSchema: z.ZodType<OrderPatch> = z.strictObject(orderFields).partial();

const spotBody = z.strictObject(spotFields);
export const spotUpsertSchema: z.ZodType<SpotWrite> = spotBody;
/** A create is the same document: the id is the column's, and the service returns it. */
export const spotCreateSchema: z.ZodType<SpotCreate> = spotBody;
export const spotPatchSchema: z.ZodType<SpotPatch> = spotBody.partial();

const settlementBody = z.strictObject(settlementFields);
export const settlementUpsertSchema: z.ZodType<SettlementWrite> = settlementBody;
export const settlementCreateSchema: z.ZodType<SettlementCreate> = settlementBody.extend({
  id: RESOURCE_ID,
});
export const settlementPatchSchema: z.ZodType<SettlementPatch> = settlementBody.partial();

const monitorBody = z.strictObject(monitorFields);
export const monitorUpsertSchema: z.ZodType<MonitorWrite> = monitorBody;
export const monitorCreateSchema: z.ZodType<MonitorCreate> = monitorBody.extend({
  id: RESOURCE_ID,
});
export const monitorPatchSchema: z.ZodType<MonitorPatch> = monitorBody.partial();
