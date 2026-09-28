import { ValidationError } from "@hewa/errors";

export interface Config {
  service: string;
  port: number;
  environment: string;
  logLevel: string;
}

/**
 * Read configuration from the environment, failing loudly on a bad value.
 *
 * Metrics Ingestion is an internal process, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const raw = source["METRICS_INGESTION_PORT"] ?? "4103";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("METRICS_INGESTION_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "@hewa/metrics-ingestion",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["METRICS_INGESTION_LOG_LEVEL"] ?? "info",
  };
}
