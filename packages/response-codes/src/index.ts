/**
 * Canonical response codes for every hewa HTTP surface.
 *
 * A code is a stable string identifier. The numeric part is grouped by
 * category and is what consumers switch on; never renumber an existing code,
 * only append.
 */
export const ResponseCode = {
  Ok: "0",
  Created: "1",
  Accepted: "2",

  InvalidRequest: "1000",
  ValidationFailed: "1001",
  MissingField: "1002",
  UnsupportedOperation: "1003",

  Unauthenticated: "2000",
  InvalidCredentials: "2001",
  TokenExpired: "2002",
  Forbidden: "2003",
  InsufficientScope: "2004",

  NotFound: "3000",
  AlreadyExists: "3001",
  Conflict: "3002",
  Gone: "3003",

  RateLimited: "4000",
  QuotaExceeded: "4001",

  Internal: "5000",
  Unavailable: "5001",
  Timeout: "5002",
  NotImplemented: "5003",
  DependencyFailure: "5004",
} as const;

export type ResponseCode = (typeof ResponseCode)[keyof typeof ResponseCode];

/**
 * Default HTTP status for each code, used when a handler does not set one.
 *
 * Keyed by the code string rather than by `ResponseCode` members: literal keys
 * let the declaration build infer the value types, which computed keys do not.
 */
const HTTP_STATUS_BY_CODE = {
  0: 200,
  1: 201,
  2: 202,

  1000: 400,
  1001: 422,
  1002: 400,
  1003: 501,

  2000: 401,
  2001: 401,
  2002: 401,
  2003: 403,
  2004: 403,

  3000: 404,
  3001: 409,
  3002: 409,
  3003: 410,

  4000: 429,
  4001: 429,

  5000: 500,
  5001: 503,
  5002: 504,
  5003: 501,
  5004: 502,
} as const satisfies Record<ResponseCode, number>;

// Annotated explicitly: the declaration build runs with `isolatedDeclarations`,
// which cannot infer a type that references another inferred binding.
export const RESPONSE_CODE_HTTP_STATUS: Record<ResponseCode, number> = HTTP_STATUS_BY_CODE;

// `ResponseCode` is keyed by name, so membership has to test the values.
const RESPONSE_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(ResponseCode));

export function isResponseCode(value: unknown): value is ResponseCode {
  return typeof value === "string" && RESPONSE_CODE_VALUES.has(value);
}

export function httpStatusFor(code: ResponseCode): number {
  return RESPONSE_CODE_HTTP_STATUS[code];
}

export const RESPONSE_CODE_CATEGORIES = [
  "ok",
  "request",
  "auth",
  "resource",
  "throttle",
  "system",
] as const;

export type ResponseCodeCategory = (typeof RESPONSE_CODE_CATEGORIES)[number];

export function categoryFor(code: ResponseCode): ResponseCodeCategory {
  // Flooring the first digits keeps the single-digit success codes (`0`, `1`,
  // `2`) in the "ok" group alongside the four-digit ranges.
  switch (Math.floor(Number.parseInt(code, 10) / 1000)) {
    case 0:
      return "ok";
    case 1:
      return "request";
    case 2:
      return "auth";
    case 3:
      return "resource";
    case 4:
      return "throttle";
    default:
      return "system";
  }
}
