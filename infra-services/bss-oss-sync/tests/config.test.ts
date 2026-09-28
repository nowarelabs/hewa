import { describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadConfig({ BSS_OSS_SYNC_PORT: "4321" })).toEqual({
      service: "@hewa/bss-oss-sync",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadConfig({
        BSS_OSS_SYNC_PORT: "4321",
        BSS_OSS_SYNC_LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadConfig({}).port).toBe(4106);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadConfig({ BSS_OSS_SYNC_PORT: "not-a-port" })).toThrow(
      "BSS_OSS_SYNC_PORT must be a port between 1 and 65535",
    );
  });
});
