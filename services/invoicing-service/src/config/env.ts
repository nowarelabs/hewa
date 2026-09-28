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
 * Invoicing Service is an internal service, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = source["INVOICING_SERVICE_PORT"] ?? "4009";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("INVOICING_SERVICE_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "@hewa/invoicing-service",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["INVOICING_SERVICE_LOG_LEVEL"] ?? "info",
  };
}
