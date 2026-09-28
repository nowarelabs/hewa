import { type DescMessage, fromBinary } from "@bufbuild/protobuf";
import {
  DeliveryPlacedSchema,
  DeliveryStatusChangedSchema,
} from "./gen/hewa/delivery/v1/delivery_pb.js";
import {
  DisputeResolvedSchema,
  InvoiceDisputedSchema,
  InvoiceIssuedSchema,
  PaymentReceivedSchema,
} from "./gen/hewa/billing/v1/billing_pb.js";
import {
  PayoutCreatedSchema,
  PayoutFailedSchema,
  PayoutSettledSchema,
} from "./gen/hewa/settlement/v1/settlement_pb.js";
import {
  OrderSyncedSchema,
  ProvisioningFailedSchema,
  SubscriberActivatedSchema,
} from "./gen/hewa/provisioning/v1/provisioning_pb.js";
import {
  SlaBreachedSchema,
  UsageIngestedSchema,
  UsageWindowClosedSchema,
} from "./gen/hewa/metering/v1/metering_pb.js";
import {
  AttestationFailedSchema,
  AttestationPublishedSchema,
  ReservesCheckFailedSchema,
  ReservesReportPublishedSchema,
} from "./gen/hewa/attestation/v1/attestation_pb.js";
import {
  FieldWorkChargedSchema,
  ServiceOrderPlacedSchema,
  ServiceOrderStatusChangedSchema,
} from "./gen/hewa/service_order/v1/service_order_pb.js";

/**
 * Physical topic names.
 *
 * A topic is a partition count, a retention window, and a set of consumer
 * groups — so it is deliberately *not* one-per-event-type. Fifteen event types
 * across fifteen topics would give each its own retention policy and make it
 * impossible for two services to consume related events in a consistent order.
 * Events are grouped by the aggregate they partition on and the rate they
 * arrive at; the event type travels in `EventEnvelope.type`.
 *
 * `v1` is a breaking-change version, not a cosmetic one. Consumers pin to it
 * and a new major gets a new topic, so a schema change is a deploy rather than
 * a race between producers and consumers.
 */
export const Topics = {
  /**
   * Meter readings and closed rating windows. By far the highest volume —
   * every reading, every five minutes, per subscriber. Short retention;
   * anything needing history reads the time-series store, not the topic.
   */
  Usage: "hewa.usage.v1",
  /** Invoices, payments, and disputes. Partitioned by invoice. */
  Billing: "hewa.billing.v1",
  /** Payout obligations and their settlement. Partitioned by ISP. */
  Settlement: "hewa.settlement.v1",
  /** Customer orders pulled from ISP BSS/OSS, and activation outcomes. */
  Provisioning: "hewa.provisioning.v1",
  /**
   * Service delivery: site surveys, installs, activations. Partitioned by
   * order, because every field event for a job has to land on the same
   * partition as the job it belongs to or the status machine tears — a replay
   * of one partition has to reconstruct the whole job.
   */
  ServiceDelivery: "hewa.service-delivery.v1",
  /**
   * Alerts, upstream sync results, operational notifications. Low volume and
   * long retention; this is the one topic anyone replays.
   */
  Operations: "hewa.operations.v1",
  /**
   * Messages that could not be processed after their retries were spent.
   * Separate from the domain topics on purpose: a poison message parked on the
   * live topic blocks a partition, and parking it where the same consumer
   * group reads means it comes straight back.
   */
  DeadLetter: "hewa.dead-letter.v1",
} as const;

export type Topic = (typeof Topics)[keyof typeof Topics];

/** Every topic, for provisioning and for the coverage test. */
export const ALL_TOPICS: readonly Topic[] = Object.values(Topics);

/**
 * Consumer group ids. A group is a cursor, so two members of one group share
 * the partitions, which is how a service scales. Two groups that both want an
 * event must not share a name, or one of them silently stops receiving it.
 */
export const ConsumerGroups = {
  /** Settlement and billing both react to a payment, at their own pace. */
  SettlementBilling: "hewa.settlement-billing.v1",
  Metering: "hewa.metering.v1",
  Provisioning: "hewa.provisioning.v1",
  WebhookDispatch: "hewa.webhook-dispatch.v1",
  Notifications: "hewa.notifications.v1",
  ReadModels: "hewa.read-models.v1",
} as const;

export type ConsumerGroup = (typeof ConsumerGroups)[keyof typeof ConsumerGroups];

/**
 * Fully qualified event type names, matching `EventEnvelope.type`.
 *
 * Written out rather than derived from the descriptors on purpose: on the wire
 * `type` is a `string`, so nothing in the type system stops a publisher from
 * typing a typo into it. Routing a message nobody recognises is a silent drop,
 * and a silent drop is the failure this registry exists to prevent.
 */
export const EventTypes = {
  UsageIngested: "hewa.metering.v1.UsageIngested",
  UsageWindowClosed: "hewa.metering.v1.UsageWindowClosed",
  SlaBreached: "hewa.metering.v1.SlaBreached",
  InvoiceIssued: "hewa.billing.v1.InvoiceIssued",
  PaymentReceived: "hewa.billing.v1.PaymentReceived",
  InvoiceDisputed: "hewa.billing.v1.InvoiceDisputed",
  DisputeResolved: "hewa.billing.v1.DisputeResolved",
  PayoutCreated: "hewa.settlement.v1.PayoutCreated",
  PayoutSettled: "hewa.settlement.v1.PayoutSettled",
  PayoutFailed: "hewa.settlement.v1.PayoutFailed",
  OrderSynced: "hewa.provisioning.v1.OrderSynced",
  SubscriberActivated: "hewa.provisioning.v1.SubscriberActivated",
  ProvisioningFailed: "hewa.provisioning.v1.ProvisioningFailed",
  DeliveryPlaced: "hewa.delivery.v1.DeliveryPlaced",
  DeliveryStatusChanged: "hewa.delivery.v1.DeliveryStatusChanged",
  AttestationPublished: "hewa.attestation.v1.AttestationPublished",
  AttestationFailed: "hewa.attestation.v1.AttestationFailed",
  ReservesReportPublished: "hewa.attestation.v1.ReservesReportPublished",
  ReservesCheckFailed: "hewa.attestation.v1.ReservesCheckFailed",
  ServiceOrderPlaced: "hewa.service_order.v1.ServiceOrderPlaced",
  ServiceOrderStatusChanged: "hewa.service_order.v1.ServiceOrderStatusChanged",
  FieldWorkCharged: "hewa.service_order.v1.FieldWorkCharged",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/** Every event type, for the test that proves the registry is exhaustive. */
export const ALL_EVENT_TYPES: readonly EventType[] = Object.values(EventTypes);

/**
 * Where an event goes, what keys its partition, and which schema decodes it.
 *
 * The key is a field name rather than a function because the envelope's payload
 * is opaque `bytes`, and a `keyof` checked against the generated type at
 * compile time is worth more than a closure that quietly returns `""`.
 */
export interface EventRoute {
  readonly topic: Topic;
  /**
   * Dotted path to the partition key, e.g. `ispId` or `attestation.city`.
   *
   * A path rather than a flat name because an event envelope that wraps its
   * payload is idiomatic — `AttestationPublished` holds an `AttestationRecord` —
   * and the alternative is a top-level `city` duplicating `attestation.city` in
   * the same message. Two copies of the routing key in one payload is one more
   * thing to keep in step, and they are only ever caught when the aggregate
   * tears.
   */
  readonly partitionKeyField: string;
  /**
   * `DescMessage`, not `GenMessage<T>`: the registry decodes payloads of any
   * event and never constructs one, so the payload type is not knowable here.
   * Every generated `GenMessage<UsageIngested>` is assignable to it, and
   * decoding goes through the schema, so nothing is lost by the table holding
   * the base descriptor.
   */
  readonly schema: DescMessage;
}

/** The routing table. Every entry in `EventTypes` needs a line here. */
export const ROUTE_BY_TYPE: Readonly<Record<EventType, EventRoute>> = {
  [EventTypes.UsageIngested]: {
    topic: Topics.Usage,
    partitionKeyField: "ispId",
    schema: UsageIngestedSchema,
  },
  [EventTypes.UsageWindowClosed]: {
    topic: Topics.Usage,
    partitionKeyField: "ispId",
    schema: UsageWindowClosedSchema,
  },
  [EventTypes.SlaBreached]: {
    topic: Topics.Usage,
    partitionKeyField: "ispId",
    schema: SlaBreachedSchema,
  },
  [EventTypes.InvoiceIssued]: {
    topic: Topics.Billing,
    partitionKeyField: "invoiceId",
    schema: InvoiceIssuedSchema,
  },
  [EventTypes.PaymentReceived]: {
    topic: Topics.Billing,
    partitionKeyField: "invoiceId",
    schema: PaymentReceivedSchema,
  },
  [EventTypes.InvoiceDisputed]: {
    topic: Topics.Billing,
    partitionKeyField: "invoiceId",
    schema: InvoiceDisputedSchema,
  },
  [EventTypes.DisputeResolved]: {
    topic: Topics.Billing,
    partitionKeyField: "invoiceId",
    schema: DisputeResolvedSchema,
  },
  [EventTypes.PayoutCreated]: {
    topic: Topics.Settlement,
    partitionKeyField: "ispId",
    schema: PayoutCreatedSchema,
  },
  [EventTypes.PayoutSettled]: {
    topic: Topics.Settlement,
    partitionKeyField: "ispId",
    schema: PayoutSettledSchema,
  },
  [EventTypes.PayoutFailed]: {
    topic: Topics.Settlement,
    partitionKeyField: "ispId",
    schema: PayoutFailedSchema,
  },
  [EventTypes.OrderSynced]: {
    topic: Topics.Provisioning,
    partitionKeyField: "ispId",
    schema: OrderSyncedSchema,
  },
  [EventTypes.SubscriberActivated]: {
    topic: Topics.Provisioning,
    partitionKeyField: "ispId",
    schema: SubscriberActivatedSchema,
  },
  [EventTypes.ProvisioningFailed]: {
    topic: Topics.Provisioning,
    partitionKeyField: "ispId",
    schema: ProvisioningFailedSchema,
  },
  [EventTypes.DeliveryPlaced]: {
    topic: Topics.ServiceDelivery,
    partitionKeyField: "orderId",
    schema: DeliveryPlacedSchema,
  },
  [EventTypes.DeliveryStatusChanged]: {
    topic: Topics.ServiceDelivery,
    partitionKeyField: "orderId",
    schema: DeliveryStatusChangedSchema,
  },
  [EventTypes.ServiceOrderPlaced]: {
    topic: Topics.ServiceDelivery,
    partitionKeyField: "orderId",
    schema: ServiceOrderPlacedSchema,
  },
  [EventTypes.ServiceOrderStatusChanged]: {
    topic: Topics.ServiceDelivery,
    partitionKeyField: "orderId",
    schema: ServiceOrderStatusChangedSchema,
  },
  [EventTypes.FieldWorkCharged]: {
    topic: Topics.ServiceDelivery,
    partitionKeyField: "orderId",
    schema: FieldWorkChargedSchema,
  },
  [EventTypes.AttestationPublished]: {
    topic: Topics.Operations,
    partitionKeyField: "attestation.city",
    schema: AttestationPublishedSchema,
  },
  [EventTypes.AttestationFailed]: {
    topic: Topics.Operations,
    partitionKeyField: "city",
    schema: AttestationFailedSchema,
  },
  [EventTypes.ReservesReportPublished]: {
    topic: Topics.Operations,
    partitionKeyField: "report.city",
    schema: ReservesReportPublishedSchema,
  },
  [EventTypes.ReservesCheckFailed]: {
    topic: Topics.Operations,
    partitionKeyField: "city",
    schema: ReservesCheckFailedSchema,
  },
};

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(ALL_EVENT_TYPES);

/** Narrow an unknown `EventEnvelope.type` to an event this system routes. */
export function isEventType(value: string): value is EventType {
  return EVENT_TYPE_SET.has(value);
}

/**
 * The route for an event type, or `undefined` if the type is unknown.
 *
 * `undefined` rather than a default topic: a default would mean an unrecognised
 * event gets published to *some* partition and picked up by *someone*, so the
 * typo surfaces days later as a missing event. Refusing to route it fails at
 * the point the mistake was made.
 */
export function routeFor(type: string): EventRoute | undefined {
  return isEventType(type) ? ROUTE_BY_TYPE[type] : undefined;
}

/**
 * Walk a dotted path over a decoded payload.
 *
 * Returns `undefined` for any missing or non-object step rather than throwing,
 * so a payload that predates a field rename is unkeyed instead of crashing the
 * consumer. The registry is validated separately, at load, so an `undefined`
 * here means the data is genuinely absent rather than the table being wrong.
 */
function resolveFieldPath(payload: unknown, path: string): unknown {
  let cursor: unknown = payload;
  for (const segment of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * The Kafka partition key for an encoded payload, or `undefined` when the
 * payload cannot be keyed.
 *
 * `undefined` rather than a random or empty key, because a wrong partition key
 * does not fail anywhere — it just splits one aggregate's events across two
 * partitions, so its status machine tears and its totals come out short, with
 * no error to explain it. A key that is absent from a well-formed payload is
 * exactly that situation, so it must not be papered over with a fallback.
 */
export function partitionKeyFor(type: string, data: Uint8Array): string | undefined {
  const route = routeFor(type);
  if (!route) return undefined;
  const payload = fromBinary(route.schema, data);
  const key = resolveFieldPath(payload, route.partitionKeyField);
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

/**
 * Every route whose partition key does not resolve to a scalar field, as
 * human-readable lines. Empty means the table is sound.
 *
 * Pure and exported so it can be tested against a deliberately broken table. A
 * validator that only ever runs against the real one is untested code that
 * always passes, which is the same failure as having no validator at all.
 */
export function unroutableRoutes(routes: Readonly<Record<string, EventRoute>>): readonly string[] {
  const broken: string[] = [];
  for (const [type, route] of Object.entries(routes)) {
    let message: DescMessage = route.schema;
    const segments = route.partitionKeyField.split(".");
    for (const [index, segment] of segments.entries()) {
      const field = message.field[segment];
      if (!field) {
        broken.push(
          `${type}: no field "${segment}" on ${message.typeName} (path "${route.partitionKeyField}")`,
        );
        break;
      }
      if (index < segments.length - 1) {
        if (!field.message) {
          broken.push(
            `${type}: "${segment}" is a ${field.fieldKind} and cannot be traversed (path "${route.partitionKeyField}")`,
          );
          break;
        }
        message = field.message;
        continue;
      }
      // The key has to be a scalar. A message or list cannot be keyed by name,
      // and an enum decodes to a number, so all three would quietly produce
      // `undefined` at publish time.
      if (field.fieldKind !== "scalar") {
        broken.push(`${type}: "${route.partitionKeyField}" is ${field.fieldKind}, not a scalar`);
      }
    }
  }
  return broken;
}

/**
 * Refuse to load a registry that cannot key its own events.
 *
 * Thrown at import rather than warned about, and it takes the whole proto
 * package down with it. That is the intent. The registry is a hand-maintained
 * table, its failure mode is silent, and every producer and consumer routes
 * through it — an unroutable key splits one aggregate across partitions, and its
 * status machine tears and its totals come out short with no error to explain
 * it. A warning here would be read once and ignored.
 */
function assertRouteKeysResolve(): void {
  const broken = unroutableRoutes(ROUTE_BY_TYPE);
  if (broken.length > 0) {
    throw new Error(
      `hewa/proto topic registry is unroutable:\n  ${broken.join("\n  ")}\n` +
        `A partition key that does not resolve splits one aggregate across partitions.`,
    );
  }
}

assertRouteKeysResolve();

/** The topic an event belongs on, or `undefined` if the type is unknown. */
export function topicFor(type: string): Topic | undefined {
  return routeFor(type)?.topic;
}

/** Every event type routed to a topic, for a producer-side registration check. */
export function eventTypesFor(topic: Topic): readonly EventType[] {
  return ALL_EVENT_TYPES.filter((type) => ROUTE_BY_TYPE[type].topic === topic);
}
