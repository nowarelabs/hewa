import { describe, expect, test } from "vite-plus/test";
import {
  Delivery,
  DeliveryStatus,
  EventEnvelope,
  EventGatewayServiceDefinition,
  Metadata,
} from "../src/index.ts";

function envelope(): EventEnvelope {
  return EventEnvelope.fromPartial({
    eventId: "evt_1",
    type: "hewa.delivery.v1.DeliveryPlaced",
    partitionKey: "order_42",
    schemaVersion: 1,
    metadata: Metadata.fromPartial({ requestId: "req_1", tenantId: "acme" }),
  });
}

describe("generated event envelope", () => {
  test("round-trips through the wire format", () => {
    const original = envelope();
    expect(EventEnvelope.decode(EventEnvelope.encode(original).finish())).toEqual(original);
  });

  test("round-trips nested metadata", () => {
    const decoded = EventEnvelope.decode(EventEnvelope.encode(envelope()).finish());
    expect(decoded.metadata?.requestId).toBe("req_1");
    expect(decoded.metadata?.tenantId).toBe("acme");
  });

  test("omits default values from the wire", () => {
    const allDefaults = EventEnvelope.encode(EventEnvelope.create()).finish();
    expect(allDefaults).toHaveLength(0);

    const sparse = EventEnvelope.encode(EventEnvelope.fromPartial({ eventId: "evt_1" })).finish();
    expect(sparse.length).toBeGreaterThan(0);
    expect(sparse.length).toBeLessThan(
      EventEnvelope.encode(
        EventEnvelope.fromPartial({ eventId: "evt_1", schemaVersion: 1 }),
      ).finish().length,
    );
  });

  test("survives a JSON round trip", () => {
    const json = EventEnvelope.toJSON(envelope());
    expect(EventEnvelope.fromJSON(json)).toEqual(envelope());
  });
});

describe("generated delivery schema", () => {
  test("defaults the status to unspecified", () => {
    expect(Delivery.create().status).toBe(DeliveryStatus.DELIVERY_STATUS_UNSPECIFIED);
  });

  test("round-trips a delivery", () => {
    const delivery = Delivery.fromPartial({
      deliveryId: "del_1",
      orderId: "order_42",
      status: DeliveryStatus.DELIVERY_STATUS_IN_TRANSIT,
      courierId: "courier_7",
    });
    expect(Delivery.decode(Delivery.encode(delivery).finish())).toEqual(delivery);
  });
});

describe("generated service definition", () => {
  test("exposes publish and subscribe methods", () => {
    const methods = EventGatewayServiceDefinition.methods;
    expect(Object.keys(methods).sort()).toEqual(["publish", "subscribe"]);
    expect(methods["publish"]?.name).toBe("Publish");
    expect(methods["subscribe"]?.responseStream).toBe(true);
    expect(methods["publish"]?.responseStream).toBe(false);
  });
});
