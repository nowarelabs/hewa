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
 * __TITLE__ is an internal service, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = source["__ENV_PREFIX___PORT"] ?? "__PORT__";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("__ENV_PREFIX___PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "__PACKAGE__",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["__ENV_PREFIX___LOG_LEVEL"] ?? "info",
  };
}
