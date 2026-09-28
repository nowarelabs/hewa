import { describe, expect, test } from "vite-plus/test";
import {
  adapterFor,
  AmdocsAdapter,
  CustomAdapter,
  OpenetAdapter,
  type AdapterConfig,
  type HttpClient,
  type UsageReport,
} from "../src/index.ts";

const config: AdapterConfig = {
  baseUrl: "https://isp.example/api",
  apiKey: "secret",
  timeoutMs: 5_000,
};

const report: UsageReport = {
  ispId: "isp_1",
  period: "2026-10",
  averageMbps: 48,
  slaActual: 0.999,
  disputed: false,
};

/** Records what was sent and replays a canned response. */
class FakeHttp implements HttpClient {
  readonly calls: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }[] = [];

  constructor(
    private readonly response: { status: number; body: string } = { status: 200, body: "{}" },
  ) {}

  async request(options: {
    method: "GET" | "POST";
    url: string;
    headers: Readonly<Record<string, string>>;
    body?: string;
  }): Promise<{ status: number; body: string }> {
    this.calls.push({ ...options, headers: { ...options.headers } });
    return this.response;
  }
}

const openetOrder = {
  orders: [
    {
      orderId: "ord_1",
      accountId: "isp_1",
      customerName: "Coastal Cafe",
      committedMbps: 50,
      burstMbps: 100,
      active: false,
    },
  ],
};

describe("adapterFor", () => {
  test("builds the adapter a system needs", () => {
    const http = new FakeHttp();
    expect(adapterFor("Openet", http, config)).toBeInstanceOf(OpenetAdapter);
    expect(adapterFor("Amdocs", http, config, "t1")).toBeInstanceOf(AmdocsAdapter);
    expect(adapterFor("Custom", http, config)).toBeInstanceOf(CustomAdapter);
  });

  test("insists on a tenant id for Amdocs", () => {
    // Amdocs nests everything under a tenant; without one every URL is wrong.
    expect(() => adapterFor("Amdocs", new FakeHttp(), config)).toThrow(/tenant id/);
    expect(() => adapterFor("Amdocs", new FakeHttp(), config, " ")).toThrow(/tenant id/);
  });
});

describe("Openet", () => {
  test("pulls orders awaiting provisioning", async () => {
    const http = new FakeHttp({ status: 200, body: JSON.stringify(openetOrder) });
    const orders = await adapterFor("Openet", http, config).pullCustomerOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({
      externalId: "ord_1",
      ispId: "isp_1",
      customerName: "Coastal Cafe",
      committedMbps: 50,
      burstMbps: 100,
      active: false,
    });
    expect(http.calls[0]?.url).toBe("https://isp.example/api/orders?status=awaiting_provisioning");
    expect(http.calls[0]?.headers.authorization).toBe("Bearer secret");
  });

  test("pushes usage in the vendor's field names", async () => {
    const http = new FakeHttp();
    await adapterFor("Openet", http, config).pushUsageReport(report);

    // The ISP's tool has to understand the payload, so the field names are
    // the vendor's, not ours.
    const body = JSON.parse(http.calls[0]?.body ?? "{}") as Record<string, unknown>;
    expect(body).toEqual({
      accountId: "isp_1",
      period: "2026-10",
      throughputMbps: 48,
      availability: 0.999,
      disputed: false,
    });
  });

  test("escapes the order id when confirming", async () => {
    const http = new FakeHttp();
    await adapterFor("Openet", http, config).confirmProvisioning("ord/../admin");
    expect(http.calls[0]?.url).toBe("https://isp.example/api/orders/ord%2F..%2Fadmin/activate");
  });
});

describe("Amdocs", () => {
  test("nests everything under a versioned tenant path", async () => {
    const http = new FakeHttp({
      status: 200,
      body: JSON.stringify({
        subscriptions: [
          {
            subscriptionId: "sub_1",
            accountId: "isp_1",
            customerName: "Harbour Ltd",
            committedMbps: 200,
            burstMbps: 400,
            lifecycleState: "provisioning",
          },
        ],
      }),
    });
    const orders = await adapterFor("Amdocs", http, config, "tenant 7").pullCustomerOrders();

    expect(http.calls[0]?.url).toBe(
      "https://isp.example/api/v1/tenants/tenant%207/subscriptions?lifecycleState=provisioning",
    );
    expect(orders[0]?.externalId).toBe("sub_1");
    expect(orders[0]?.active).toBe(false);
  });

  test("maps its lifecycle string onto the shared boolean", async () => {
    const http = new FakeHttp({
      status: 200,
      body: JSON.stringify({
        subscriptions: [
          {
            subscriptionId: "sub_2",
            accountId: "isp_1",
            customerName: "Harbour Ltd",
            committedMbps: 200,
            burstMbps: 400,
            lifecycleState: "active",
          },
        ],
      }),
    });
    const orders = await adapterFor("Amdocs", http, config, "t1").pullCustomerOrders();
    expect(orders[0]?.active).toBe(true);
  });
});

describe("Custom", () => {
  test("speaks our own shape, and still validates it", async () => {
    // "They agreed to our webhook" is a claim about a third party, so the
    // payload is checked rather than trusted.
    const http = new FakeHttp({
      status: 200,
      body: JSON.stringify({
        orders: [
          {
            id: "o1",
            ispId: "isp_1",
            customer: "Corner Shop",
            committedMbps: 10,
            burstMbps: 20,
            active: true,
          },
        ],
      }),
    });
    const orders = await adapterFor("Custom", http, config).pullCustomerOrders();
    expect(orders[0]?.externalId).toBe("o1");
    expect(http.calls[0]?.url).toBe("https://isp.example/api/webhooks/orders");
  });

  test("rejects an order missing its identifier", async () => {
    const http = new FakeHttp({
      status: 200,
      body: JSON.stringify({
        orders: [{ ispId: "isp_1", customer: "X", committedMbps: 1, burstMbps: 2, active: true }],
      }),
    });
    // A missing id would produce a sync that quietly skips a customer's order.
    await expect(adapterFor("Custom", http, config).pullCustomerOrders()).rejects.toThrow(
      /required field/,
    );
  });
});

describe("failure handling", () => {
  test("raises on a non-2xx without echoing the vendor body", async () => {
    const http = new FakeHttp({ status: 500, body: '{"customer":"Jane Doe","ssn":"..."}' });
    // The upstream body can carry customer data and belongs in the vendor's
    // logs, not in an exception we will log on our side.
    await expect(adapterFor("Openet", http, config).pullCustomerOrders()).rejects.toThrow(
      /BSS\/OSS request failed/,
    );
    await expect(adapterFor("Openet", http, config).pullCustomerOrders()).rejects.not.toThrow(
      /Jane Doe/,
    );
  });

  test("raises on a body that is not JSON", async () => {
    const http = new FakeHttp({ status: 200, body: "<html>maintenance</html>" });
    await expect(adapterFor("Openet", http, config).pullCustomerOrders()).rejects.toThrow(
      /not JSON/,
    );
  });

  test("raises when the expected collection is absent", async () => {
    const http = new FakeHttp({ status: 200, body: '{"unexpected":true}' });
    await expect(adapterFor("Openet", http, config).pullCustomerOrders()).rejects.toThrow(
      /missing a collection/,
    );
  });

  test("rejects a negative bandwidth figure", async () => {
    const http = new FakeHttp({
      status: 200,
      body: JSON.stringify({
        orders: [
          {
            orderId: "o",
            accountId: "isp_1",
            customerName: "X",
            committedMbps: -1,
            burstMbps: 2,
            active: false,
          },
        ],
      }),
    });
    await expect(adapterFor("Openet", http, config).pullCustomerOrders()).rejects.toThrow(
      /invalid numeric field/,
    );
  });
});
