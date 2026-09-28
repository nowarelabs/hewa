import { ValidationError } from "@hewa/errors";

export interface Env {
  service: string;
  port: number;
  environment: string;
  logLevel: string;
}

/**
 * Read configuration from the environment, failing loudly on a bad value.
 *
 * Reconciliation Service is an internal service, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = source["RECONCILIATION_SERVICE_PORT"] ?? "4010";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("RECONCILIATION_SERVICE_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "@hewa/reconciliation-service",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["RECONCILIATION_SERVICE_LOG_LEVEL"] ?? "info",
  };
}
