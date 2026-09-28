import { describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadConfig({ SYSTEM_QUEUE_PORT: "4321" })).toEqual({
      service: "@hewa/system-queue",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadConfig({
        SYSTEM_QUEUE_PORT: "4321",
        SYSTEM_QUEUE_LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadConfig({}).port).toBe(4102);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadConfig({ SYSTEM_QUEUE_PORT: "not-a-port" })).toThrow(
      "SYSTEM_QUEUE_PORT must be a port between 1 and 65535",
    );
  });
});
