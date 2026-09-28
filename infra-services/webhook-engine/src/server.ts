import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { httpStatusFor, ResponseCode } from "@hewa/response-codes";
import {
  createLogger,
  isLogLevel,
  runWithRequestContext,
  resolveRequestId,
  type Logger,
} from "@hewa/observability";
import { toAppError } from "@hewa/errors";

export interface ServerOptions {
  service: string;
  environment: string;
  logLevel: string;
}

/** Build a logger from configuration, falling back to `info` on a bad level. */
export function createServerLogger(options: ServerOptions): Logger {
  return createLogger({
    service: options.service,
    environment: options.environment,
    level: isLogLevel(options.logLevel) ? options.logLevel : "info",
  });
}

/**
 * The HTTP surface of Webhook Engine.
 *
 * Kept separate from `main.ts` so the process entry point stays about wiring,
 * and so the router can be tested without binding a port.
 */
export function createServer(options: ServerOptions): Hono {
  return createApp(createServerLogger(options), options.service);
}

export function createApp(logger: Logger, service: string): Hono {
  const app = new Hono();

  // Registered before any route: Hono only applies middleware added ahead of
  // the handlers it should wrap.
  app.use("*", async (context, next) => {
    const requestId = resolveRequestId(context.req.raw.headers);
    context.header("x-request-id", requestId);
    return runWithRequestContext({ requestId, service }, () => next());
  });

  app.get("/health", (context) =>
    context.json(
      { service, code: ResponseCode.Ok, status: "ok" },
      httpStatusFor(ResponseCode.Ok) as ContentfulStatusCode,
    ),
  );

  app.onError((error, context) => {
    const appError = toAppError(error);
    logger.error("request failed", { error, errorCode: appError.code });
    return context.json(appError.toJSON(), appError.httpStatus as ContentfulStatusCode);
  });

  return app;
}
