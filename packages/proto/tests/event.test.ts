import { create, fromBinary, fromJson, toBinary, toJson } from "@bufbuild/protobuf";
import { describe, expect, test } from "vite-plus/test";
import {
  ALL_EVENT_TYPES,
  ALL_TOPICS,
  ConsumerGroups,
  DeliverySchema,
  DeliveryStatus,
  EventEnvelopeSchema,
  AttestationService,
  BillingService,
  DeliveryService,
  EventGatewayService,
  EventTypes,
  IdentityService,
  MeteringService,
  ProvisioningService,
  RatesService,
  ServiceOrderService,
  SettlementService,
  type EventRoute,
  type EventType,
  ROUTE_BY_TYPE,
  Topics,
  unroutableRoutes,
  InvoiceSchema,
  InvoiceStatus,
  MetadataSchema,
  MoneySchema,
  PayoutObligationSchema,
  UsageIngestedSchema,
  AttestationPublishedSchema,
  AttestationRecordSchema,
  DeliveryStatusChangedSchema,
  ReservesReportPublishedSchema,
  ReservesCheckFailedSchema,
  ReservesReportSchema,
  ServiceOrderPlacedSchema,
  eventTypesFor,
  isEventType,
  partitionKeyFor,
  routeFor,
  topicFor,
} from "../src/index.ts";

describe("generated event envelope", () => {
  const envelope = () =>
    create(EventEnvelopeSchema, {
      eventId: "evt_1",
      type: EventTypes.DeliveryPlaced,
      partitionKey: "order_42",
      schemaVersion: 1,
      metadata: create(MetadataSchema, { requestId: "req_1", tenantId: "acme" }),
    });

  test("round-trips through the wire format", () => {
    const original = envelope();
    expect(fromBinary(EventEnvelopeSchema, toBinary(EventEnvelopeSchema, original))).toEqual(
      original,
    );
  });

  test("round-trips nested metadata", () => {
    const decoded = fromBinary(EventEnvelopeSchema, toBinary(EventEnvelopeSchema, envelope()));
    expect(decoded.metadata?.requestId).toBe("req_1");
    expect(decoded.metadata?.tenantId).toBe("acme");
  });

  test("omits default values from the wire", () => {
    expect(toBinary(EventEnvelopeSchema, create(EventEnvelopeSchema))).toHaveLength(0);

    const sparse = toBinary(EventEnvelopeSchema, create(EventEnvelopeSchema, { eventId: "evt_1" }));
    const withVersion = toBinary(
      EventEnvelopeSchema,
      create(EventEnvelopeSchema, { eventId: "evt_1", schemaVersion: 1 }),
    );
    expect(sparse.length).toBeGreaterThan(0);
    expect(sparse.length).toBeLessThan(withVersion.length);
  });

  test("survives a JSON round trip", () => {
    const original = envelope();
    expect(fromJson(EventEnvelopeSchema, toJson(EventEnvelopeSchema, original))).toEqual(original);
  });
});

describe("generated delivery schema", () => {
  test("defaults the status to unspecified", () => {
    expect(create(DeliverySchema).status).toBe(DeliveryStatus.UNSPECIFIED);
  });

  test("round-trips a field visit", () => {
    const delivery = create(DeliverySchema, {
      deliveryId: "del_1",
      orderId: "order_42",
      status: DeliveryStatus.ON_SITE,
      engineerId: "eng_7",
      surveyedDistanceMetres: 340,
    });
    expect(fromBinary(DeliverySchema, toBinary(DeliverySchema, delivery))).toEqual(delivery);
  });

  test("a visit that ended is not a visit that delivered", () => {
    // `SURVEYED` and `COMPLETED` are the same "done" to a courier. Here the
    // distinction is the whole point: a surveyed site is still unbuilt, and
    // reading it as completed would let an order activate for a site nobody
    // has cabled.
    expect(DeliveryStatus.COMPLETED).not.toBe(DeliveryStatus.ON_SITE);
    expect(DeliveryStatus.FAILED).not.toBe(DeliveryStatus.CANCELLED);
  });
});

describe("generated service descriptor", () => {
  test("exposes publish and subscribe methods", () => {
    const methods = EventGatewayService.method;
    expect(Object.keys(methods).sort()).toEqual(["publish", "subscribe"]);
    expect(methods.publish.methodKind).toBe("unary");
    expect(methods.subscribe.methodKind).toBe("server_streaming");
  });
});

/**
 * These four schemas are the ones the barrel used to omit. They are asserted
 * here rather than trusted, because a missing line in `src/index.ts` produces no
 * error anywhere — the symbol simply does not exist for a consumer, and the
 * package has no subpath export to reach it by another route.
 */
describe("barrel completeness", () => {
  test("re-exports money", () => {
    const amount = create(MoneySchema, { currency: "USD", amountMinor: 1_250_000n });
    expect(fromBinary(MoneySchema, toBinary(MoneySchema, amount))).toEqual(amount);
  });

  test("re-exports billing, settlement, and metering messages", () => {
    expect(create(InvoiceSchema).status).toBe(InvoiceStatus.UNSPECIFIED);
    expect(create(PayoutObligationSchema).chainId).toBe(0n);
    expect(create(UsageIngestedSchema).readingsInBatch).toBe(0);
  });
});

describe("topic registry", () => {
  test("routes every declared event type", () => {
    for (const type of ALL_EVENT_TYPES) {
      expect(routeFor(type), type).toBeDefined();
    }
  });

  test("refuses to route an unknown type rather than defaulting", () => {
    expect(isEventType("hewa.billing.v1.NotAThing")).toBe(false);
    expect(routeFor("hewa.billing.v1.NotAThing")).toBeUndefined();
    expect(topicFor("")).toBeUndefined();
  });

  test("keys usage by ISP so one ISP's readings stay ordered", () => {
    const data = toBinary(
      UsageIngestedSchema,
      create(UsageIngestedSchema, { ispId: "vituIT", subscriberId: "sub_1" }),
    );
    expect(partitionKeyFor(EventTypes.UsageIngested, data)).toBe("vituIT");
    expect(topicFor(EventTypes.UsageIngested)).toBe("hewa.usage.v1");
  });

  test("keys a delivery and its status changes identically", () => {
    const placed = create(UsageIngestedSchema, { ispId: "x" });
    // The point of the assertion is the routing table, not the encoding: a
    // placement and its later status changes must hash to the same key or a
    // replay of one partition cannot reconstruct the job.
    expect(routeFor(EventTypes.DeliveryPlaced)?.partitionKeyField).toBe(
      routeFor(EventTypes.DeliveryStatusChanged)?.partitionKeyField,
    );
    expect(placed.ispId).toBe("x");
  });

  test("returns undefined for a payload that cannot be keyed", () => {
    const empty = toBinary(UsageIngestedSchema, create(UsageIngestedSchema));
    expect(partitionKeyFor(EventTypes.UsageIngested, empty)).toBeUndefined();
    expect(partitionKeyFor("hewa.billing.v1.NotAThing", new Uint8Array())).toBeUndefined();
  });

  test("gives every topic a versioned, namespaced name", () => {
    for (const topic of ALL_TOPICS) {
      expect(topic, topic).toMatch(/^hewa\.[a-z-]+\.v\d+$/);
    }
  });

  test("keeps consumer group ids distinct from topic names", () => {
    const groups = Object.values(ConsumerGroups);
    expect(new Set(groups).size).toBe(groups.length);
  });
});

/**
 * The registry has to be updated by hand when a schema is added, which is
 * exactly the kind of step that gets skipped by someone adding an event at
 * 6pm. A missing route is not a compile error: the event is generated, the
 * service publishes it, and nothing consumes it. So the check is mechanical —
 * walk every message in every generated file and assert it is routed.
 */
describe("registry stays exhaustive", () => {
  /**
   * A real payload per event, not a synthetic probe. The failure this guards
   * against is a route naming a field that does not exist, which is not a
   * compile error: the event generates, the service publishes it, and every
   * consumer keys it to `undefined` and puts the aggregate's events in
   * different partitions. `assertRouteKeysResolve` catches that at import; these
   * cases pin the two halves independently so neither can regress alone.
   */
  const cases = [
    {
      type: EventTypes.UsageIngested,
      key: "ispId",
      want: "isp:1",
      build: () => create(UsageIngestedSchema, { ispId: "isp:1" }),
    },
    {
      type: EventTypes.ServiceOrderPlaced,
      key: "orderId",
      want: "ord:1",
      build: () => create(ServiceOrderPlacedSchema, { orderId: "ord:1" }),
    },
    {
      type: EventTypes.DeliveryStatusChanged,
      key: "orderId",
      want: "ord:1",
      build: () => create(DeliveryStatusChangedSchema, { orderId: "ord:1" }),
    },
    {
      type: EventTypes.AttestationPublished,
      key: "attestation.city",
      want: "jnb",
      build: () =>
        create(AttestationPublishedSchema, {
          attestation: create(AttestationRecordSchema, { city: "jnb" }),
        }),
    },
    {
      type: EventTypes.ReservesReportPublished,
      key: "report.city",
      want: "jnb",
      build: () =>
        create(ReservesReportPublishedSchema, {
          report: create(ReservesReportSchema, { city: "jnb" }),
        }),
    },
  ];

  test.each(cases)("$type keys a real payload on $key", ({ type, key, want, build }) => {
    expect(routeFor(type)?.partitionKeyField).toBe(key);
    // Round-trips through the wire, because the registry decodes bytes: a
    // `create`d object proves nothing about what `fromBinary` reconstructs.
    expect(partitionKeyFor(type, toBinary(schemaOf(type), build()))).toBe(want);
  });

  test("an unkeyable payload is refused, not defaulted", () => {
    // The city is unset. A fallback key would scatter one city's attestations
    // across every partition, so this has to be `undefined`.
    const data = toBinary(
      AttestationPublishedSchema,
      create(AttestationPublishedSchema, { attestation: create(AttestationRecordSchema, {}) }),
    );
    expect(partitionKeyFor(EventTypes.AttestationPublished, data)).toBeUndefined();
    expect(partitionKeyFor("hewa.nope.v1.Nope", new Uint8Array())).toBeUndefined();
  });

  const schemaOf = (type: EventType) => {
    const schema = routeFor(type)?.schema;
    if (!schema) throw new Error(`no route for ${type}`);
    return schema;
  };

  test("routes an event to exactly one topic", () => {
    for (const type of ALL_EVENT_TYPES) {
      const topics = ALL_TOPICS.filter((topic) => eventTypesFor(topic).includes(type));
      expect(topics, type).toHaveLength(1);
    }
  });
});

describe("registry validation", () => {
  // Every one of these is a route that would compile, publish, and silently
  // put one aggregate's events in different partitions. The real table is
  // checked at import, so without these cases the validator is never seen to
  // reject anything.
  const route = (over: Partial<EventRoute>): EventRoute => ({
    topic: Topics.Operations,
    partitionKeyField: "city",
    schema: AttestationPublishedSchema,
    ...over,
  });

  test("accepts the real table", () => {
    expect(unroutableRoutes(ROUTE_BY_TYPE)).toEqual([]);
  });

  test("rejects a field that does not exist", () => {
    const broken = unroutableRoutes({ X: route({ partitionKeyField: "citty" }) });
    expect(broken[0]).toMatch(/no field "citty" on hewa\.attestation\.v1\.AttestationPublished/);
  });

  test("rejects a path into a scalar, not a message", () => {
    // `attestation` is a message and `attestation.city` a string, so there is
    // nothing to descend past that. A deep path over a scalar silently yields
    // `undefined` otherwise.
    const broken = unroutableRoutes({
      X: route({ partitionKeyField: "attestation.city.nope" }),
    });
    expect(broken[0]).toMatch(/"city" is a scalar and cannot be traversed/);
  });

  test("rejects a message as the key itself", () => {
    const broken = unroutableRoutes({ X: route({ partitionKeyField: "attestation" }) });
    expect(broken[0]).toMatch(/"attestation" is message, not a scalar/);
  });

  test("rejects a repeated field as the key", () => {
    // `repeated string reasons` decodes to an array, whose `typeof` is
    // `object`, so a key naming it would be refused at publish time.
    const broken = unroutableRoutes({
      X: route({ partitionKeyField: "reasons", schema: ReservesCheckFailedSchema }),
    });
    expect(broken[0]).toMatch(/"reasons" is list, not a scalar/);
  });

  test("rejects an enum, which decodes to a number not a key", () => {
    const broken = unroutableRoutes({
      X: route({ partitionKeyField: "status", schema: DeliveryStatusChangedSchema }),
    });
    expect(broken[0]).toMatch(/"status" is enum, not a scalar/);
  });

  test("reports every broken route at once", () => {
    // One error per import is the difference between a two-minute fix and a
    // fix-one-reload loop through a dozen bad rows.
    const broken = unroutableRoutes({
      A: route({ partitionKeyField: "citty" }),
      B: route({ partitionKeyField: "attestation" }),
      C: route({ partitionKeyField: "nope" }),
    });
    expect(broken).toHaveLength(3);
  });
});

describe("service descriptors", () => {
  /**
   * Every service, with its methods. Written out by hand on purpose: a test
   * that derived the list from the descriptors would pass whatever was
   * generated, including nothing. The failure this guards against is an empty
   * or half-written `service` block, which `buf lint` accepts and which
   * generates cleanly into a client that calls nothing.
   */
  const services = [
    {
      service: EventGatewayService,
      typeName: "hewa.event.v1.EventGatewayService",
      methods: ["Publish", "Subscribe"],
      // The one stream on the platform. It exists because a browser cannot hold
      // a gRPC channel and Kafka has no browser client, so the push surface
      // goes through the gateway as a server stream. Everything else is unary:
      // a stream held open against a service with no reason to keep it is a
      // connection that has to be reaped.
      streams: ["Subscribe"],
    },
    {
      service: IdentityService,
      typeName: "hewa.identity.v1.IdentityService",
      methods: ["Authenticate", "IssueToken", "ResolveApiKey", "RevokeApiKey"],
      streams: [],
    },
    { service: RatesService, typeName: "hewa.rates.v1.RatesService", methods: ["Quote"] },
    {
      service: AttestationService,
      typeName: "hewa.attestation.v1.AttestationService",
      methods: ["AttestDay", "AttestMonth", "LatestAttestation", "ListAttestations"],
      streams: [],
    },
    {
      service: ServiceOrderService,
      typeName: "hewa.service_order.v1.ServiceOrderService",
      methods: ["PlaceOrder", "GetOrder", "TransitionOrder", "ListOrders"],
      streams: [],
    },
    {
      service: DeliveryService,
      typeName: "hewa.delivery.v1.DeliveryService",
      methods: ["PlaceDelivery", "GetDelivery", "TransitionDelivery", "ListDeliveries"],
      streams: [],
    },
    {
      service: BillingService,
      typeName: "hewa.billing.v1.BillingService",
      methods: [
        "CalculateBill",
        "GetInvoice",
        "ListInvoices",
        "RecordPayment",
        "RaiseDispute",
        "ResolveDispute",
        "ReceivablesSummary",
      ],
      streams: [],
    },
    {
      service: MeteringService,
      typeName: "hewa.metering.v1.MeteringService",
      methods: ["IngestReading", "GetUsage", "CloseWindow", "EvaluateSla"],
      streams: [],
    },
    {
      service: SettlementService,
      typeName: "hewa.settlement.v1.SettlementService",
      methods: [
        "CreatePayout",
        "GetPayout",
        "ListPayouts",
        "QuoteConversion",
        "PrepareTransfer",
        "RecordPayoutSent",
        "RecordPayoutFailed",
        "SettlementSummary",
      ],
      streams: [],
    },
    {
      service: ProvisioningService,
      typeName: "hewa.provisioning.v1.ProvisioningService",
      methods: ["SubmitOrder", "GetCustomerOrder", "ListCustomerOrders", "RetryProvisioning"],
      streams: [],
    },
  ];

  test.each(services)(
    "$typeName exposes exactly its declared methods",
    ({ service, typeName, methods }) => {
      expect(service.typeName).toBe(typeName);
      // `name` is the PascalCase rpc as written in the proto; `localName` is its
      // camelCase form. The proto spelling is the one worth pinning, since that
      // is what the `.proto` file and the wire path use.
      expect(service.methods.map((m) => m.name).sort()).toEqual([...methods].sort());
    },
  );

  test("every method names a real request and response message", () => {
    for (const { service, streams = [] } of services) {
      for (const method of service.methods) {
        const { name } = method;
        // `requestType`/`responseType` are descriptors, not types, so this
        // holds even for a request that is a bare `GenMessage` with no fields
        // — which is what an unfinished placeholder looks like, and it
        // generates and type-checks without complaint.
        expect(method.input.kind, name).toBe("message");
        expect(method.output.kind, name).toBe("message");
        // Left at `IDEMPOTENCY_UNKNOWN` (0) on every method, deliberately.
        // Declaring `IDEMPOTENT` lets a Connect interceptor retry the call for
        // free, which is only correct if the server honours the
        // `idempotency_key` in the request — and a method that claims it and
        // does not honour it gets silently replayed into a double payment.
        // The keys are carried in the messages and checked by the service.
        expect(method.idempotency, name).toBe(0);
        // Unary unless explicitly listed, so a stream added to a service that
        // has no use for one fails here rather than in production.
        expect(method.methodKind, name).toBe(streams.includes(name) ? "server_streaming" : "unary");
      }
    }
  });
});
