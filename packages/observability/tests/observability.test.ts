import { describe, expect, test } from "vite-plus/test";
import {
  createMemorySink,
  DEFAULT_BUCKETS,
  Logger,
  MetricsRegistry,
  enrichRequestContext,
  getRequestId,
  resolveRequestId,
  runWithRequestContext,
  serializeError,
  type LogRecord,
} from "../src/index.ts";

const options = {
  service: "test-service",
  environment: "test",
  level: "debug",
} as const;

function recordingLogger(): { logger: Logger; records: LogRecord[] } {
  const sink = createMemorySink();
  return { logger: new Logger({ ...options, sink }), records: sink.records };
}

describe("Logger", () => {
  test("emits the envelope fields", () => {
    const { logger, records } = recordingLogger();
    logger.info("started", { port: 3000 });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: "info",
      message: "started",
      service: "test-service",
      environment: "test",
      port: 3000,
    });
    expect(records[0]?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("merges child fields into every record", () => {
    const { logger, records } = recordingLogger();
    logger.child({ tenant: "acme" }).info("one");
    logger.child({ tenant: "acme" }).warn("two");
    expect(records.map((r) => r.tenant)).toEqual(["acme", "acme"]);
  });

  test("drops records below the configured level", () => {
    const sink = createMemorySink();
    const logger = new Logger({ ...options, level: "warn", sink });
    logger.info("ignored");
    logger.error("kept");
    expect(sink.records.map((r) => r.message)).toEqual(["kept"]);
  });

  test("lifts the bound requestId onto the record", () => {
    const { logger, records } = recordingLogger();
    logger.child({ requestId: "req_1" }).info("inside");
    expect(records[0]?.requestId).toBe("req_1");
  });

  test("serializes an error field", () => {
    const { logger, records } = recordingLogger();
    logger.error("failed", { error: new Error("boom") });
    expect(records[0]?.error).toMatchObject({ name: "Error", message: "boom" });
  });
});

describe("request context", () => {
  test("propagates the request id through async work", async () => {
    const seen = await runWithRequestContext({ requestId: "req_x", service: "s" }, async () => {
      await Promise.resolve();
      return getRequestId();
    });
    expect(seen).toBe("req_x");
  });

  test("enriches the active context", () => {
    runWithRequestContext({ requestId: "req_y", service: "s" }, () => {
      enrichRequestContext({ tenant: "acme" });
      expect(getRequestId()).toBe("req_y");
    });
  });

  test("prefers an inbound request id", () => {
    const headers = new Headers({ "x-request-id": "from-edge" });
    expect(resolveRequestId(headers)).toBe("from-edge");
  });

  test("generates an id when there is no inbound one", () => {
    const id = resolveRequestId(new Headers());
    expect(id).toMatch(/^req_/);
    expect(id).not.toBe(resolveRequestId(new Headers()));
  });
});

describe("MetricsRegistry", () => {
  test("keeps counter series separate per label set", () => {
    const metrics = new MetricsRegistry();
    metrics.increment("requests_total", { route: "/a" });
    metrics.increment("requests_total", { route: "/a" });
    metrics.increment("requests_total", { route: "/b" });
    expect(metrics.collect()).toEqual([
      { type: "counter", name: "requests_total", labels: { route: "/a" }, value: 2 },
      { type: "counter", name: "requests_total", labels: { route: "/b" }, value: 1 },
    ]);
  });

  test("overwrites gauges rather than accumulating", () => {
    const metrics = new MetricsRegistry();
    metrics.setGauge("queue_depth", 5);
    metrics.setGauge("queue_depth", 2);
    expect(metrics.collect()).toEqual([
      { type: "gauge", name: "queue_depth", labels: {}, value: 2 },
    ]);
  });

  test("accumulates histogram count, sum, and cumulative buckets", () => {
    const metrics = new MetricsRegistry({ buckets: [1, 10] });
    metrics.observe("latency_seconds", 0.5);
    metrics.observe("latency_seconds", 5);
    const [sample] = metrics.collect();
    expect(sample).toMatchObject({ type: "histogram", count: 2, sum: 5.5 });
    expect(sample?.type === "histogram" ? sample.buckets : {}).toEqual({
      "1": 1,
      "10": 2,
      "+Inf": 2,
    });
  });

  test("ships a default bucket set", () => {
    expect(DEFAULT_BUCKETS).toContain(0.1);
  });

  test("reset clears everything", () => {
    const metrics = new MetricsRegistry();
    metrics.increment("requests_total");
    metrics.reset();
    expect(metrics.collect()).toEqual([]);
  });
});

describe("serializeError", () => {
  test("handles non-Error throwables", () => {
    expect(serializeError("nope")).toEqual({ name: "NonError", message: "nope" });
  });
});
