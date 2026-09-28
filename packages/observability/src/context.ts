/**
 * Request-scoped context, carried by `AsyncLocalStorage` so that a log line
 * emitted deep inside a handler still knows which request it belongs to.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  service: string;
  method?: string;
  path?: string;
  startedAt?: number;
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Add fields to the current context without replacing it. */
export function enrichRequestContext(fields: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (current) Object.assign(current, fields);
}

let counter = 0;

/** Generate a request id, preferring one supplied by an upstream hop. */
export function resolveRequestId(headers: {
  get(name: string): string | null | undefined;
}): string {
  const inbound = headers.get("x-request-id")?.trim();
  if (inbound) return inbound;
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `req_${Date.now().toString(36)}_${counter.toString(36)}`;
}
