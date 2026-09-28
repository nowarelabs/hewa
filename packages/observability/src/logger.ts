/**
 * Structured logging and request context.
 *
 * There is no vendor SDK here on purpose: the point is one logging shape that
 * every service and app in the workspace emits, plus the request-scoped context
 * that ties a log line back to the request that produced it. Swapping in a
 * transport later is a change to `createLogger`, not to call sites.
 */

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogFields = Record<string, unknown>;

export interface LogRecord extends LogFields {
  time: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  requestId?: string;
  error?: { name: string; message: string; stack?: string };
}

export type LogSink = (record: LogRecord) => void;

/** A sink that writes newline-delimited JSON to stderr, for container logs. */
export function createJsonSink(
  write: (line: string) => void = (line) => {
    process.stderr.write(line);
  },
): LogSink {
  return (record) => {
    write(`${JSON.stringify(record)}\n`);
  };
}

/** A sink that keeps records in memory, for tests. */
export function createMemorySink(): LogSink & { records: LogRecord[] } {
  const records: LogRecord[] = [];
  const sink = (record: LogRecord) => {
    records.push(record);
  };
  return Object.assign(sink, { records });
}

export interface LoggerOptions {
  service: string;
  environment: string;
  level: LogLevel;
  sink: LogSink;
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && value in LEVEL_RANK;
}

export class Logger {
  readonly #options: LoggerOptions;
  readonly #bound: LogFields;

  constructor(options: LoggerOptions, bound: LogFields = {}) {
    this.#options = options;
    this.#bound = bound;
  }

  /** Return a logger that merges `fields` into every record. */
  child(fields: LogFields): Logger {
    return new Logger(this.#options, { ...this.#bound, ...fields });
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LEVEL_RANK[level] >= LEVEL_RANK[this.#options.level];
  }

  debug(message: string, fields?: LogFields): void {
    this.#write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.#write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.#write("warn", message, fields);
  }

  error(message: string, fields?: LogFields & { error?: unknown }): void {
    const { error, ...rest } = fields ?? {};
    this.#write("error", message, error === undefined ? rest : { ...rest, error });
  }

  #write(level: LogLevel, message: string, fields?: LogFields): void {
    if (!this.isLevelEnabled(level)) return;

    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      message,
      service: this.#options.service,
      environment: this.#options.environment,
      ...this.#bound,
      ...fields,
    };

    const requestId = this.#bound["requestId"];
    if (typeof requestId === "string") record.requestId = requestId;

    this.#options.sink(record);
  }
}

export function createLogger(options: Partial<LoggerOptions> & { service: string }): Logger {
  return new Logger({
    environment: process.env["NODE_ENV"] ?? "development",
    level: parseLogLevel(process.env["LOG_LEVEL"]) ?? "info",
    sink: createJsonSink(),
    ...options,
  });
}

function parseLogLevel(value: string | undefined): LogLevel | undefined {
  return isLogLevel(value) ? value : undefined;
}

export function serializeError(error: unknown): LogRecord["error"] {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error) };
  return {
    name: error.name,
    message: error.message,
    ...(error.stack === undefined ? {} : { stack: error.stack }),
  };
}
