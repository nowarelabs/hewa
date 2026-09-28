import { ValidationError } from "@hewa/errors";
import type { BssOssSystem } from "@hewa/marketplace-types";

/**
 * A customer order as the ISP's own billing system reports it.
 *
 * This is the shape the sync pulls in: "this customer signed up for 50 Mbps and
 * needs it provisioned". It is deliberately the ISP's vocabulary, not ours.
 */
export interface CustomerOrder {
  /** The ISP's own identifier for the order, echoed back on every update. */
  readonly externalId: string;
  readonly ispId: string;
  readonly customerName: string;
  readonly committedMbps: number;
  readonly burstMbps: number;
  /** True once the ISP believes the service is live. */
  readonly active: boolean;
}

/** Measured performance sent back into the ISP's dashboard. */
export interface UsageReport {
  readonly ispId: string;
  /** `YYYY-MM`, the period the report covers. */
  readonly period: string;
  readonly averageMbps: number;
  /** Availability delivered in the period, as a fraction. */
  readonly slaActual: number;
  /** True when measured usage disagrees with what was reported. */
  readonly disputed: boolean;
}

export interface BssOssAdapter {
  /** The suite this adapter talks to. */
  readonly system: BssOssSystem;
  /** Pull orders the ISP has placed but that are not yet provisioned. */
  pullCustomerOrders(): Promise<readonly CustomerOrder[]>;
  /** Push measured usage back so the ISP's team sees it in their own tool. */
  pushUsageReport(report: UsageReport): Promise<void>;
  /** Confirm that a provisioned order is live on both sides. */
  confirmProvisioning(externalId: string): Promise<void>;
}

/**
 * The HTTP surface an adapter needs.
 *
 * Injected rather than imported so an adapter is a pure translation layer: the
 * tests exercise real request shapes and real response handling against a fake,
 * with no network and no credentials in the repository.
 */
export interface HttpClient {
  request(options: {
    readonly method: "GET" | "POST";
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  }): Promise<{ readonly status: number; readonly body: string }>;
}

/** Base URL and credential for one ISP's instance. */
export interface AdapterConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  /** Milliseconds before a request is abandoned. */
  readonly timeoutMs: number;
}

function assertOk(status: number, url: string): void {
  if (status < 200 || status >= 300) {
    // The upstream body is deliberately not propagated: it can carry customer
    // data, and it belongs in the vendor's own logs, not in an exception that
    // will be logged on our side.
    throw new ValidationError("BSS/OSS request failed", { status, url });
  }
}

function authHeaders(config: AdapterConfig): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
}

/**
 * Adapter for the Openet suite.
 *
 * Openet exposes orders under `/orders` and accepts updates as a POST to
 * `/orders/{id}/usage`. Both are behind the tenant base URL.
 */
export class OpenetAdapter implements BssOssAdapter {
  readonly system = "Openet" as const;

  constructor(
    private readonly http: HttpClient,
    private readonly config: AdapterConfig,
  ) {}

  async pullCustomerOrders(): Promise<readonly CustomerOrder[]> {
    const url = `${this.config.baseUrl}/orders?status=awaiting_provisioning`;
    const response = await this.http.request({
      method: "GET",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
    const parsed = parseJson(response.body, url) as { orders?: unknown };
    return parseOpenetOrders(parsed.orders, url);
  }

  async pushUsageReport(report: UsageReport): Promise<void> {
    const url = `${this.config.baseUrl}/usage-reports`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
      body: JSON.stringify({
        accountId: report.ispId,
        period: report.period,
        throughputMbps: report.averageMbps,
        availability: report.slaActual,
        disputed: report.disputed,
      }),
    });
    assertOk(response.status, url);
  }

  async confirmProvisioning(externalId: string): Promise<void> {
    const url = `${this.config.baseUrl}/orders/${encodeURIComponent(externalId)}/activate`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
  }
}

/**
 * Adapter for the Amdocs suite.
 *
 * Amdocs nests everything under a version segment and requires the tenant id in
 * the path, which is why it cannot share Openet's URL building.
 */
export class AmdocsAdapter implements BssOssAdapter {
  readonly system = "Amdocs" as const;

  constructor(
    private readonly http: HttpClient,
    private readonly config: AdapterConfig,
    private readonly tenantId: string,
  ) {}

  private get root(): string {
    return `${this.config.baseUrl}/v1/tenants/${encodeURIComponent(this.tenantId)}`;
  }

  async pullCustomerOrders(): Promise<readonly CustomerOrder[]> {
    const url = `${this.root}/subscriptions?lifecycleState=provisioning`;
    const response = await this.http.request({
      method: "GET",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
    const parsed = parseJson(response.body, url) as { subscriptions?: unknown };
    return parseAmdocsSubscriptions(parsed.subscriptions, url);
  }

  async pushUsageReport(report: UsageReport): Promise<void> {
    const url = `${this.root}/usageSnapshots`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
      body: JSON.stringify({
        subscriptionGroup: report.ispId,
        billingPeriod: report.period,
        meanThroughputMbps: report.averageMbps,
        serviceAvailability: report.slaActual,
        underDispute: report.disputed,
      }),
    });
    assertOk(response.status, url);
  }

  async confirmProvisioning(externalId: string): Promise<void> {
    const url = `${this.root}/subscriptions/${encodeURIComponent(externalId)}/activate`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
  }
}

/**
 * Adapter for an ISP with no suite of its own.
 *
 * The only contract a bespoke system has agreed to is a webhook, so this pushes
 * a signed payload and accepts whatever the ISP sends back in the same shape.
 */
export class CustomAdapter implements BssOssAdapter {
  readonly system = "Custom" as const;

  constructor(
    private readonly http: HttpClient,
    private readonly config: AdapterConfig,
  ) {}

  async pullCustomerOrders(): Promise<readonly CustomerOrder[]> {
    const url = `${this.config.baseUrl}/webhooks/orders`;
    const response = await this.http.request({
      method: "GET",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
    const parsed = parseJson(response.body, url) as { orders?: unknown };
    return parseCustomOrders(parsed.orders, url);
  }

  async pushUsageReport(report: UsageReport): Promise<void> {
    const url = `${this.config.baseUrl}/webhooks/usage`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
      body: JSON.stringify(report),
    });
    assertOk(response.status, url);
  }

  async confirmProvisioning(externalId: string): Promise<void> {
    const url = `${this.config.baseUrl}/webhooks/orders/${encodeURIComponent(externalId)}/active`;
    const response = await this.http.request({
      method: "POST",
      url,
      headers: authHeaders(this.config),
    });
    assertOk(response.status, url);
  }
}

/** Build the adapter for a system, from a client and a config. */
export function adapterFor(
  system: BssOssSystem,
  http: HttpClient,
  config: AdapterConfig,
  tenantId?: string,
): BssOssAdapter {
  switch (system) {
    case "Openet":
      return new OpenetAdapter(http, config);
    case "Amdocs":
      if (tenantId === undefined || tenantId.trim() === "") {
        throw new ValidationError("The Amdocs adapter needs a tenant id", {});
      }
      return new AmdocsAdapter(http, config, tenantId);
    case "Custom":
      return new CustomAdapter(http, config);
  }
}

/**
 * @param body
 * @param url
 */
function parseJson(body: string, url: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    throw new ValidationError("BSS/OSS returned a body that is not JSON", {
      url,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

function asRecord(value: unknown, url: string, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("Unexpected shape in a BSS/OSS payload", { url, field });
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string, url: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    // A missing identifier would produce a sync that silently skips an order.
    throw new ValidationError("BSS/OSS payload is missing a required field", { url, field });
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, field: string, url: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError("BSS/OSS payload has an invalid numeric field", { url, field });
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string, url: string): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw new ValidationError("BSS/OSS payload has an invalid boolean field", { url, field });
  }
  return value;
}

function requireArray(value: unknown, url: string, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("BSS/OSS payload is missing a collection", { url, field });
  }
  return value;
}

function parseOpenetOrders(value: unknown, url: string): CustomerOrder[] {
  return requireArray(value, url, "orders").map((entry) => {
    const record = asRecord(entry, url, "orders[]");
    return {
      externalId: requireString(record, "orderId", url),
      ispId: requireString(record, "accountId", url),
      customerName: requireString(record, "customerName", url),
      committedMbps: requireNumber(record, "committedMbps", url),
      burstMbps: requireNumber(record, "burstMbps", url),
      active: requireBoolean(record, "active", url),
    };
  });
}

function parseAmdocsSubscriptions(value: unknown, url: string): CustomerOrder[] {
  return requireArray(value, url, "subscriptions").map((entry) => {
    const record = asRecord(entry, url, "subscriptions[]");
    return {
      externalId: requireString(record, "subscriptionId", url),
      ispId: requireString(record, "accountId", url),
      customerName: requireString(record, "customerName", url),
      committedMbps: requireNumber(record, "committedMbps", url),
      burstMbps: requireNumber(record, "burstMbps", url),
      // Amdocs uses a lifecycle string where the other two use a boolean.
      active: requireString(record, "lifecycleState", url) === "active",
    };
  });
}

function parseCustomOrders(value: unknown, url: string): CustomerOrder[] {
  // A bespoke system agreed to our shape, so it maps one to one — but it is
  // still validated, because "agreed to our shape" is a claim about a third
  // party rather than something this process can rely on.
  return requireArray(value, url, "orders").map((entry) => {
    const record = asRecord(entry, url, "orders[]");
    return {
      externalId: requireString(record, "id", url),
      ispId: requireString(record, "ispId", url),
      customerName: requireString(record, "customer", url),
      committedMbps: requireNumber(record, "committedMbps", url),
      burstMbps: requireNumber(record, "burstMbps", url),
      active: requireBoolean(record, "active", url),
    };
  });
}
