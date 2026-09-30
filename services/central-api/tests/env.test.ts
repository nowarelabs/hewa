import { describe, expect, test } from "vite-plus/test";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadEnv({ CENTRAL_API_PORT: "4321" })).toEqual({
      service: "@hewa/central-api",
      port: 4321,
      environment: "development",
      logLevel: "info",
      corsOrigins: ["http://localhost:3005"],
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadEnv({
        CENTRAL_API_PORT: "4321",
        CENTRAL_API_LOG_LEVEL: "debug",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadEnv({}).port).toBe(4000);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadEnv({ CENTRAL_API_PORT: "not-a-port" })).toThrow(
      "CENTRAL_API_PORT must be a port between 1 and 65535",
    );
  });

  test("rejects a port outside the valid range", () => {
    expect(() => loadEnv({ CENTRAL_API_PORT: "70000" })).toThrow();
  });

  describe("cors origins", () => {
    test("splits a comma separated list and trims each origin", () => {
      expect(
        loadEnv({
          CENTRAL_API_CORS_ORIGINS: "http://localhost:3005, https://console.hewa.africa",
        }).corsOrigins,
      ).toEqual(["http://localhost:3005", "https://console.hewa.africa"]);
    });

    test("drops an empty entry rather than allowing an empty origin", () => {
      expect(loadEnv({ CENTRAL_API_CORS_ORIGINS: "http://localhost:3005,," }).corsOrigins).toEqual([
        "http://localhost:3005",
      ]);
    });

    test("rejects a list with nothing in it", () => {
      expect(() => loadEnv({ CENTRAL_API_CORS_ORIGINS: " , " })).toThrow(
        "CENTRAL_API_CORS_ORIGINS must name at least one browser origin",
      );
    });

    test("allows a wildcard outside production", () => {
      expect(loadEnv({ CENTRAL_API_CORS_ORIGINS: "*" }).corsOrigins).toEqual(["*"]);
    });

    test("refuses a wildcard in production", () => {
      expect(() => loadEnv({ CENTRAL_API_CORS_ORIGINS: "*", NODE_ENV: "production" })).toThrow(
        "CENTRAL_API_CORS_ORIGINS must not be a wildcard in production",
      );
    });
  });
});
