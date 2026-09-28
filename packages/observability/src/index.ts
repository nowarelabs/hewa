export {
  createJsonSink,
  createLogger,
  createMemorySink,
  isLogLevel,
  Logger,
  LOG_LEVELS,
  serializeError,
  type LogFields,
  type LogLevel,
  type LogRecord,
  type LogSink,
  type LoggerOptions,
} from "./logger.ts";

export {
  enrichRequestContext,
  getRequestContext,
  getRequestId,
  resolveRequestId,
  runWithRequestContext,
  type RequestContext,
} from "./context.ts";

export {
  DEFAULT_BUCKETS,
  MetricsRegistry,
  type CounterSample,
  type GaugeSample,
  type HistogramSample,
  type MetricSample,
  type MetricType,
} from "./metrics.ts";

import { getRequestId } from "./context.ts";
import { createLogger, type LogFields, type Logger } from "./logger.ts";
import { MetricsRegistry } from "./metrics.ts";

/**
 * The per-process singleton. Service shells call `getLogger()` rather than
 * threading a logger through every function.
 */
let logger: Logger | undefined;
let registry: MetricsRegistry | undefined;

export function setLogger(next: Logger): void {
  logger = next;
}

export function getLogger(): Logger {
  logger ??= createLogger({ service: "hewa" });
  return logger;
}

export function getMetrics(): MetricsRegistry {
  registry ??= new MetricsRegistry();
  return registry;
}

/** Log fields every error path should include. */
export function errorFields(error: unknown): LogFields {
  return { error, requestId: getRequestId() };
}
