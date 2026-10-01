import { describe, expect, test } from "vite-plus/test";
import { loadEnv } from "../src/config/env.js";

/**
 * The two settings no test may omit, because neither has a default.
 *
 * The token is the subject of this file's largest block below, so every other test
 * sets it to get past the guard question and on to what it is actually about. The
 * database URL is here for the same reason and for a different reason: it *does*
 * stop the process, so a test that omitted it would be asserting against a thrown
 * error rather than a parsed environment.
 */
const withDefaults = (source: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  CENTRAL_API_SERVICE_TOKEN: "test-token",
  CENTRAL_API_DATABASE_URL: "postgres://central-api@127.0.0.1:5432/central_api_test",
  ...source,
});

/**
 * Just the database URL, so a test about the token is not also a test about it.
 *
 * `withDefaults` sets both because no test may omit either; this sets only one,
 * for the block that is specifically about one of them being absent.
 */
const withDatabase = (source: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  CENTRAL_API_DATABASE_URL: "postgres://central-api@127.0.0.1:5432/central_api_test",
  ...source,
});

describe("loadEnv", () => {
  test("reads the port and defaults the rest", () => {
    expect(loadEnv(withDefaults({ CENTRAL_API_PORT: "4321" }))).toEqual({
      service: "@hewa/central-api",
      port: 4321,
      environment: "development",
      logLevel: "info",
      serviceToken: "test-token",
      databaseUrl: "postgres://central-api@127.0.0.1:5432/central_api_test",
      corsOrigins: ["http://localhost:3005"],
    });
  });

  test("prefers an explicitly configured value", () => {
    expect(
      loadEnv(
        withDefaults({
          CENTRAL_API_PORT: "4321",
          CENTRAL_API_LOG_LEVEL: "debug",
          NODE_ENV: "production",
        }),
      ),
    ).toMatchObject({ port: 4321, logLevel: "debug", environment: "production" });
  });

  test("falls back to the template port when unset", () => {
    expect(loadEnv(withDefaults()).port).toBe(4000);
  });

  test("rejects a value that is not a port", () => {
    expect(() => loadEnv(withDefaults({ CENTRAL_API_PORT: "not-a-port" }))).toThrow(
      "CENTRAL_API_PORT must be a port between 1 and 65535",
    );
  });

  test("rejects a port outside the valid range", () => {
    expect(() => loadEnv(withDefaults({ CENTRAL_API_PORT: "70000" }))).toThrow();
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
      expect(loadEnv(withDatabase()).serviceToken).toBeUndefined();
    });

    test("an empty value is missing, not a token", () => {
      // An empty string passes a truthiness check in most code and compares
      // equal to nothing, so a guard built on `===` would accept it. Collapsing
      // it to `undefined` here means the guard's "nothing configured" branch
      // handles it, which refuses the request instead of comparing against "".
      expect(loadEnv(withDatabase({ CENTRAL_API_SERVICE_TOKEN: "" })).serviceToken).toBeUndefined();
      expect(
        loadEnv(withDatabase({ CENTRAL_API_SERVICE_TOKEN: undefined })).serviceToken,
      ).toBeUndefined();
    });

    test("its absence is not fatal, so the process still starts", () => {
      // The distinction this file exists to pin down: a *wrong* value throws, an
      // absent one does not. It is a different failure with a different fix, and
      // collapsing the two into one error message loses which one happened.
      expect(() => loadEnv(withDatabase())).not.toThrow();
      expect(() => loadEnv(withDatabase({ NODE_ENV: "production" }))).not.toThrow();
    });

    test("a value that is present is kept, and never reported as missing", () => {
      // The other half. If a configured token could read as absent, every
      // deployment would answer 503 and the symptom would look like the guard
      // refusing a correct token.
      expect(
        loadEnv(withDefaults({ CENTRAL_API_SERVICE_TOKEN: "a-real-token" })).serviceToken,
      ).toBe("a-real-token");
    });

    test("it is read verbatim, not trimmed or hashed", () => {
      // Whatever the deploy sets is what the guard compares against. A token
      // silently trimmed on load would compare against a different string than
      // the one sent, and every request would 401 with nothing to point at.
      expect(loadEnv(withDefaults({ CENTRAL_API_SERVICE_TOKEN: "  spaced  " })).serviceToken).toBe(
        "  spaced  ",
      );
    });
  });

  /**
   * The database connection string, and the one setting in this file that is
   * genuinely required.
   *
   * ## Why this one throws and the token does not
   *
   * The token is a credential, and a service missing a credential can still be
   * genuinely useful: `/health` answers, the console loads, and every data route
   * refuses with a 503 naming the variable. That is failing closed, and it leaves
   * a developer with a running process and a message.
   *
   * A database is a dependency rather than a credential, and the difference is what
   * happens without one. `drizzle` takes its URL lazily, so a service booted without
   * one would start, report `ok` on `/health`, and fail every single query — a
   * state where a load balancer sends traffic, an operator debugs from the wrong
   * end, and the health endpoint is the thing lying. Refusing the boot is the
   * honest version: no process, and a message that says which variable to set.
   */
  describe("the database url", () => {
    test("it is required, and its absence stops the boot", () => {
      expect(() => loadEnv({ CENTRAL_API_SERVICE_TOKEN: "t" })).toThrow(
        "CENTRAL_API_DATABASE_URL must be a PostgreSQL connection string",
      );
    });

    test("an empty value is an absent one", () => {
      // A variable set to "" is the shape a compose file with a missing entry
      // produces, and `postgres:///hewa` is a *valid* URL — to the local socket, on
      // the developer's own machine. `||` rather than `??` is what catches it here,
      // at boot, instead of on the first query.
      expect(() =>
        loadEnv({
          CENTRAL_API_SERVICE_TOKEN: "t",
          CENTRAL_API_DATABASE_URL: "",
        }),
      ).toThrow(/CENTRAL_API_DATABASE_URL/);
    });

    test("its absence is fatal even in production, and even with a token", () => {
      // Nothing about the environment makes a missing database survivable, and
      // `NODE_ENV` is the variable that has historically been allowed to change
      // what is required. It is not allowed to change this.
      for (const nodeEnv of ["development", "production", "test"]) {
        expect(
          () => loadEnv({ CENTRAL_API_SERVICE_TOKEN: "t", NODE_ENV: nodeEnv }),
          nodeEnv,
        ).toThrow(/CENTRAL_API_DATABASE_URL/);
      }
    });

    test("the message names the command that fixes it", () => {
      // A configuration error whose message says "must be set" and nothing else
      // sends the reader to the repository to work out which of five commands runs
      // the migrations. This one says so in the same sentence.
      expect(() => loadEnv({ CENTRAL_API_SERVICE_TOKEN: "t" })).toThrow(/db:migrate/);
    });

    test("a configured url is read verbatim", () => {
      const url = "postgres://hewa:secret@db.internal:5432/hewa?sslmode=require";
      expect(loadEnv(withDefaults({ CENTRAL_API_DATABASE_URL: url })).databaseUrl).toBe(url);
    });
  });

  describe("cors origins", () => {
    test("splits a comma separated list and trims each origin", () => {
      expect(
        loadEnv(
          withDefaults({
            CENTRAL_API_CORS_ORIGINS: "http://localhost:3005, https://console.hewa.africa",
          }),
        ).corsOrigins,
      ).toEqual(["http://localhost:3005", "https://console.hewa.africa"]);
    });

    test("drops an empty entry rather than allowing an empty origin", () => {
      expect(
        loadEnv(withDefaults({ CENTRAL_API_CORS_ORIGINS: "http://localhost:3005,," })).corsOrigins,
      ).toEqual(["http://localhost:3005"]);
    });

    test("rejects a list with nothing in it", () => {
      expect(() => loadEnv(withDefaults({ CENTRAL_API_CORS_ORIGINS: " , " }))).toThrow(
        "CENTRAL_API_CORS_ORIGINS must name at least one browser origin",
      );
    });

    test("allows a wildcard outside production", () => {
      expect(loadEnv(withDefaults({ CENTRAL_API_CORS_ORIGINS: "*" })).corsOrigins).toEqual(["*"]);
    });

    test("refuses a wildcard in production", () => {
      expect(() =>
        loadEnv(withDefaults({ CENTRAL_API_CORS_ORIGINS: "*", NODE_ENV: "production" })),
      ).toThrow("CENTRAL_API_CORS_ORIGINS must not be a wildcard in production");
    });
  });
});
