import { ValidationError } from "@hewa/errors";

export interface Env {
  service: string;
  port: number;
  environment: string;
  logLevel: string;
  /**
   * Browser origins allowed to call `/console`.
   *
   * Comma separated, and `*` is refused unless `environment` is not production:
   * a wildcard on an endpoint that returns operational data is a decision to have
   * no decision, and it is much easier to type than to mean.
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
    corsOrigins,
  };
}
