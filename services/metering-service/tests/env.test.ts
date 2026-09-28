import { describe, expect, test } from "vite-plus/test";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadEnv({ METERING_SERVICE_PORT: "4321" })).toEqual({
      service: "@hewa/metering-service",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadEnv({
        METERING_SERVICE_PORT: "4321",
        METERING_SERVICE_LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadEnv({}).port).toBe(4007);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadEnv({ METERING_SERVICE_PORT: "not-a-port" })).toThrow(
      "METERING_SERVICE_PORT must be a port between 1 and 65535",
    );
  });

  test("rejects a port outside the valid range", () => {
    expect(() => loadEnv({ METERING_SERVICE_PORT: "70000" })).toThrow();
  });
});
