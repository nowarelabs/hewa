import { describe, expect, test } from "vite-plus/test";
import { loadEnv } from "../src/config/env.js";

/**
 * A token for every call, because there is no default for it — which is the
 * first thing this file asserts, and the reason the helper exists at all. Without
 * it every one of the other tests would be about a view that answered 503, which
 * is this file's other subject and not the one most of these are about.
 */
const withToken = (source: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  CENTRAL_API_SERVICE_TOKEN: "test-token",
  ...source,
});

describe("loadEnv", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadEnv(withToken({ CENTRAL_API_PORT: "4321" }))).toEqual({
      service: "@hewa/central-api",
      port: 4321,
      environment: "development",
      logLevel: "info",
      serviceToken: "test-token",
      corsOrigins: ["http://localhost:3005"],
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadEnv(
        withToken({
          CENTRAL_API_PORT: "4321",
          CENTRAL_API_LOG_LEVEL: "debug",
          NODE_ENV: "production",
        }),
      ),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadEnv(withToken({})).port).toBe(4000);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadEnv(withToken({ CENTRAL_API_PORT: "not-a-port" }))).toThrow(
      "CENTRAL_API_PORT must be a port between 1 and 65535",
    );
  });

  test("rejects a port outside the valid range", () => {
    expect(() => loadEnv(withToken({ CENTRAL_API_PORT: "70000" }))).toThrow();
  });

  describe("the service token", () => {
    /**
     * The one setting in this file with no default, and the assertions that say
     * why — along with why it does not stop the process.
     *
     * Every other value here degrades to something sensible, because a wrong port
     * is a deploy mistake with an obvious symptom. A default token would be a
     * secret every developer shares, and it would work in the one environment
     * nobody is watching: a development central-api readable by anything on the
     * network, with a credential that is in the repository.
     *
     * What it does instead of defaulting is refuse every `/api/v1` route with a
     * 503 naming itself. Throwing here was the first version of this and it was
     * worse: a developer who had not copied `.env.example` to `.env` got a stack
     * trace out of `nest start --watch` and no process, so there was no `/health`
     * and no way to tell a missing token from a broken service. Failing *closed*
     * is the requirement; crashing is not a way to meet it.
     */
    test("it has no default to fall back to", () => {
      expect(loadEnv({}).serviceToken).toBeUndefined();
    });

    test("an empty value is missing, not a token", () => {
      // An empty string passes a truthiness check in most code and compares
      // equal to nothing, so a guard built on `===` would accept it. Collapsing
      // it to `undefined` here means the guard's "nothing configured" branch
      // handles it, which refuses the request instead of comparing against "".
      expect(loadEnv({ CENTRAL_API_SERVICE_TOKEN: "" }).serviceToken).toBeUndefined();
      expect(loadEnv({ CENTRAL_API_SERVICE_TOKEN: undefined }).serviceToken).toBeUndefined();
    });

    test("its absence is not fatal, so the process still starts", () => {
      // The distinction this file exists to pin down: a *wrong* value throws, an
      // absent one does not. It is a different failure with a different fix, and
      // collapsing the two into one error message loses which one happened.
      expect(() => loadEnv({})).not.toThrow();
      expect(() => loadEnv({ NODE_ENV: "production" })).not.toThrow();
    });

    test("a value that is present is kept, and never reported as missing", () => {
      // The other half. If a configured token could read as absent, every
      // deployment would answer 503 and the symptom would look like the guard
      // refusing a correct token.
      expect(loadEnv({ CENTRAL_API_SERVICE_TOKEN: "a-real-token" }).serviceToken).toBe(
        "a-real-token",
      );
    });

    test("it is read verbatim, not trimmed or hashed", () => {
      // Whatever the deploy sets is what the guard compares against. A token
      // silently trimmed on load would compare against a different string than
      // the one sent, and every request would 401 with nothing to point at.
      expect(loadEnv({ CENTRAL_API_SERVICE_TOKEN: "  spaced  " }).serviceToken).toBe("  spaced  ");
    });
  });

  describe("cors origins", () => {
    test("splits a comma separated list and trims each origin", () => {
      expect(
        loadEnv(
          withToken({
            CENTRAL_API_CORS_ORIGINS: "http://localhost:3005, https://console.hewa.africa",
          }),
        ).corsOrigins,
      ).toEqual(["http://localhost:3005", "https://console.hewa.africa"]);
    });

    test("drops an empty entry rather than allowing an empty origin", () => {
      expect(
        loadEnv(withToken({ CENTRAL_API_CORS_ORIGINS: "http://localhost:3005,," })).corsOrigins,
      ).toEqual(["http://localhost:3005"]);
    });

    test("rejects a list with nothing in it", () => {
      expect(() => loadEnv(withToken({ CENTRAL_API_CORS_ORIGINS: " , " }))).toThrow(
        "CENTRAL_API_CORS_ORIGINS must name at least one browser origin",
      );
    });

    test("allows a wildcard outside production", () => {
      expect(loadEnv(withToken({ CENTRAL_API_CORS_ORIGINS: "*" })).corsOrigins).toEqual(["*"]);
    });

    test("refuses a wildcard in production", () => {
      expect(() =>
        loadEnv(withToken({ CENTRAL_API_CORS_ORIGINS: "*", NODE_ENV: "production" })),
      ).toThrow("CENTRAL_API_CORS_ORIGINS must not be a wildcard in production");
    });
  });
});
