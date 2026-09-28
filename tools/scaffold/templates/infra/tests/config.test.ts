import { describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadConfig({ __ENV_PREFIX___PORT: "4321" })).toEqual({
      service: "__PACKAGE__",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadConfig({
        __ENV_PREFIX___PORT: "4321",
        __ENV_PREFIX___LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadConfig({}).port).toBe(__PORT__);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadConfig({ __ENV_PREFIX___PORT: "not-a-port" })).toThrow(
      "__ENV_PREFIX___PORT must be a port between 1 and 65535",
    );
  });
});
