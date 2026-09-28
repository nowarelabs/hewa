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
 * Payment Gateway Adapter is an internal process, so it is configured by environment rather
 * than by a file: a missing variable is a deploy error, not a default.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const raw = source["PAYMENT_GATEWAY_ADAPTER_PORT"] ?? "4104";
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new ValidationError("PAYMENT_GATEWAY_ADAPTER_PORT must be a port between 1 and 65535", {
      received: raw,
    });
  }

  return {
    service: "@hewa/payment-gateway-adapter",
    port,
    environment: source["NODE_ENV"] ?? "development",
    logLevel: source["PAYMENT_GATEWAY_ADAPTER_LOG_LEVEL"] ?? "info",
  };
}
