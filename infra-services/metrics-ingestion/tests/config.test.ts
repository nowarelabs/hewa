import { describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadConfig({ METRICS_INGESTION_PORT: "4321" })).toEqual({
      service: "@hewa/metrics-ingestion",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadConfig({
        METRICS_INGESTION_PORT: "4321",
        METRICS_INGESTION_LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadConfig({}).port).toBe(4103);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadConfig({ METRICS_INGESTION_PORT: "not-a-port" })).toThrow(
      "METRICS_INGESTION_PORT must be a port between 1 and 65535",
    );
  });
});
