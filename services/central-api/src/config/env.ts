import { ValidationError } from "@hewa/errors";

export interface Env {
  service: string;
  port: number;
  environment: string;
  logLevel: string;
  /**
   * The PostgreSQL connection string.
   *
   * Required, and unlike the service token there is no "absent is survivable"
   * branch for it. The token is a secret and can be missing while the process is
   * genuinely useful; this is a dependency, and a service that boots without one
   * answers `/health` with `ok` while every single query fails — which is a lie
   * a load balancer believes and an operator debugs from the wrong end. So the
   * boot stops here and the message names the variable.
   */
  databaseUrl: string;
  /**
   * The shared secret the web app presents on `/api/v1`, or `undefined` if none
   * is configured.
   *
   * The proxy in front of this service is not access control — see
   * `ServiceTokenGuard` — so this is the value that decides who may read.
   *
   * Absent rather than an empty string, and the difference is load-bearing: an
   * empty string is a *value*, and a guard comparing against one would accept
   * any request that presented an empty token, which is a plausible thing for a
   * misconfigured client to send. `undefined` cannot be compared against at all,
   * so the guard has to handle it explicitly and does — by refusing every
   * request. See `ServiceTokenGuard`.
   */
  serviceToken: string | undefined;
  /**
   * The shared secret a caller must present to write, or `undefined` if none is
   * configured.
   *
   * A second secret rather than a flag on {@link Env.serviceToken}, because the two
   * answer different questions and are held by different parties: this one decides
   * who may change a record, that one decides who may read one. Anything that can
   * read the console can be handed the first without the second.
   *
   * Absent rather than an empty string, for the reason the read token is: an empty
   * string is a *value*, and a guard comparing against one would accept a request
   * that presented an empty token. See `WriteTokenGuard`.
   */
  writeToken: string | undefined;
  /**
   * Browser origins allowed to call this service.
   *
   * Comma separated, and `*` is refused unless `environment` is not production:
   * a wildcard on an endpoint that returns operational data is a decision to have
   * no decision, and it is much easier to type than to mean.
   *
   * The console's browser traffic is proxied through the web app's own route
   * handlers, so nothing in the app calls this service cross-origin any more.
   * The setting is kept because `/health` is probed by browser-facing tooling and
   * because a direct browser client is a legitimate thing to add later — and
   * because deleting it would leave a service that fails with an opaque CORS
   * error the first time somebody did.
   */
  corsOrigins: string[];
}

/**
 * Read configuration from the environment, failing loudly on a bad value.
 *
 * Central API is an internal service, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 *
 * `corsOrigins` is the one setting here that is not a scalar, and it is parsed
 * rather than defaulted to a list so that adding a second app is a configuration
 * change and not a code change. The console is the first consumer; a second
 * portal is a second entry in this variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = source["CENTRAL_API_PORT"] ?? "4000";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("CENTRAL_API_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  const environment = source["NODE_ENV"] ?? "development";

  // No default, and that is the point. Every other setting here has one, because
  // a wrong port is a deploy mistake with an obvious symptom. A default token
  // would be a secret every developer shares, and it would work in the one
  // environment nobody is watching: a development central-api reachable from
  // anything on the network, with a credential that is in the repository.
  //
  // Absent is not fatal, and that is the other half of the decision. Throwing
  // here — the obvious way to make a secret required — means a developer who has
  // not copied `.env.example` to `.env` gets a stack trace out of `nest start
  // --watch` and a process that is not up, so there is nothing to probe and no
  // way to see the console work apart from the service. So instead the service
  // starts, `/health` answers, and every `/api/v1` route answers 503 naming the
  // variable. `ServiceTokenGuard` is where that refusal happens, and the boot
  // warning in `main.ts` is where it is announced. Failing *closed* is the
  // requirement; crashing is not a way to achieve it.
  //
  // `||` rather than `??` so that a variable set to "" is treated as absent
  // rather than as a token nobody can guess but everybody can send.
  const serviceToken = source["CENTRAL_API_SERVICE_TOKEN"] || undefined;

  // `||` for the same reason, and the same refusal when absent: the write routes
  // are reachable with no token configured and every one of them answers 503
  // naming this variable. A write service that boots, serves reads, and refuses
  // every write is a degraded deployment someone can diagnose from the message; one
  // that boots and accepts writes from anybody is not a deployment anybody can
  // diagnose at all.
  const writeToken = source["CENTRAL_API_WRITE_TOKEN"] || undefined;

  // `||` rather than `??` for the same reason as the token: a variable set to ""
  // is an unset variable, and `postgres:///db` is a valid-looking URL to the
  // local socket that would fail on the first query rather than at boot.
  const databaseUrl = source["CENTRAL_API_DATABASE_URL"] || "";

  if (databaseUrl === "") {
    // The fix is in the message rather than only in `details`, because the details
    // are printed by the error filter and this is thrown at boot, where what
    // reaches the terminal is `err.message` on its own. A configuration error that
    // says "must be set" and stops there sends the reader to the repository to work
    // out which of a dozen scripts runs the migrations.
    throw new ValidationError(
      "CENTRAL_API_DATABASE_URL must be a PostgreSQL connection string — copy " +
        "services/central-api/.env.example to .env and run " +
        "`pnpm --filter @hewa/central-api db:migrate`",
      { received: source["CENTRAL_API_DATABASE_URL"] },
    );
  }

  const corsOrigins = (source["CENTRAL_API_CORS_ORIGINS"] ?? "http://localhost:3005")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  if (corsOrigins.length === 0) {
    throw new ValidationError("CENTRAL_API_CORS_ORIGINS must name at least one browser origin", {
      received: source["CENTRAL_API_CORS_ORIGINS"],
    });
  }

  if (corsOrigins.includes("*") && environment === "production") {
    throw new ValidationError("CENTRAL_API_CORS_ORIGINS must not be a wildcard in production", {
      received: source["CENTRAL_API_CORS_ORIGINS"],
    });
  }

  return {
    service: "@hewa/central-api",
    port,
    environment,
    logLevel: source["CENTRAL_API_LOG_LEVEL"] ?? "info",
    databaseUrl,
    serviceToken,
    writeToken,
    corsOrigins,
  };
}
