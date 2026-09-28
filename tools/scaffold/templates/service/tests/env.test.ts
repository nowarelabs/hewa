import { describe, expect, test } from "vite-plus/test";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadEnv({ __ENV_PREFIX___PORT: "4321" })).toEqual({
      service: "__PACKAGE__",
      port: 4321,
      environment: "development",
      logLevel: "info",
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadEnv({
        __ENV_PREFIX___PORT: "4321",
        __ENV_PREFIX___LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadEnv({}).port).toBe(__PORT__);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadEnv({ __ENV_PREFIX___PORT: "not-a-port" })).toThrow(
      "__ENV_PREFIX___PORT must be a port between 1 and 65535",
    );
  });

  test("rejects a port outside the valid range", () => {
    expect(() => loadEnv({ __ENV_PREFIX___PORT: "70000" })).toThrow();
  });
});
