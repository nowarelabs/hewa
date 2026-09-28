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
 * Webhook Engine is an internal process, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const raw = source["WEBHOOK_ENGINE_PORT"] ?? "4105";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("WEBHOOK_ENGINE_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "@hewa/webhook-engine",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["WEBHOOK_ENGINE_LOG_LEVEL"] ?? "info",
  };
}
