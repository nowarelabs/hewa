import {
  categoryFor,
  httpStatusFor,
  ResponseCode,
  type ResponseCodeCategory,
} from "@hewa/response-codes";

/** Stable, machine-readable identifier for a kind of failure. */
export const ErrorCode = {
  ValidationFailed: "validation_failed",
  ResourceNotFound: "resource_not_found",
  ResourceConflict: "resource_conflict",
  Unauthenticated: "unauthenticated",
  Forbidden: "forbidden",
  RateLimited: "rate_limited",
  DependencyUnavailable: "dependency_unavailable",
  NotImplemented: "not_implemented",
  Internal: "internal",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Keyed by the error code string so a lookup by `code` hits directly. Literal
// keys keep the declaration build able to infer the value types; computed keys
// are not inferable under `isolatedDeclarations`.
const RESPONSE_CODE_BY_ERROR_CODE = {
  validation_failed: ResponseCode.ValidationFailed,
  resource_not_found: ResponseCode.NotFound,
  resource_conflict: ResponseCode.Conflict,
  unauthenticated: ResponseCode.Unauthenticated,
  forbidden: ResponseCode.Forbidden,
  rate_limited: ResponseCode.RateLimited,
  dependency_unavailable: ResponseCode.DependencyFailure,
  not_implemented: ResponseCode.NotImplemented,
  internal: ResponseCode.Internal,
} as const satisfies Record<ErrorCode, ResponseCode>;

export type ErrorDetails = Record<string, unknown>;

export interface SerializedError {
  code: ErrorCode;
  responseCode: ResponseCode;
  message: string;
  details?: ErrorDetails;
  cause?: string;
  requestId?: string;
}

/**
 * The base class for every failure that crosses a hewa service boundary.
 *
 * It carries a stable `code`, carries over the `requestId` from the active
 * observability context, and serializes to a shape that is safe to return to a
 * client. Anything that is *not* an `AppError` is treated as an internal
 * fault and its message is never exposed.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly responseCode: ResponseCode;
  readonly details?: ErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetails; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = new.target.name;
    this.code = code;
    this.responseCode = RESPONSE_CODE_BY_ERROR_CODE[code];
    this.details = options?.details;
    Error.captureStackTrace?.(this, new.target);
  }

  get httpStatus(): number {
    return httpStatusFor(this.responseCode);
  }

  get category(): ResponseCodeCategory {
    return categoryFor(this.responseCode);
  }

  toJSON(requestId?: string): SerializedError {
    const serialized: SerializedError = {
      code: this.code,
      responseCode: this.responseCode,
      message: this.message,
    };
    if (this.details) serialized.details = this.details;
    const cause = this.cause;
    if (cause instanceof Error) serialized.cause = cause.message;
    if (requestId) serialized.requestId = requestId;
    return serialized;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.ValidationFailed, message, details ? { details } : undefined);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      ErrorCode.ResourceNotFound,
      id === undefined ? `${resource} was not found` : `${resource} "${String(id)}" was not found`,
      { details: { resource, ...(id === undefined ? {} : { id }) } },
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.ResourceConflict, message, details ? { details } : undefined);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required") {
    super(ErrorCode.Unauthenticated, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(ErrorCode.Forbidden, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests", retryAfterSeconds?: number) {
    super(
      ErrorCode.RateLimited,
      message,
      retryAfterSeconds === undefined ? undefined : { details: { retryAfterSeconds } },
    );
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(dependency: string, cause?: unknown) {
    super(ErrorCode.DependencyUnavailable, `${dependency} is unavailable`, {
      cause,
      details: { dependency },
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(what: string) {
    super(ErrorCode.NotImplemented, `${what} is not implemented`);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Normalize anything thrown into a serializable error. Unknown throwables
 * become an opaque internal fault so implementation details never leak.
 */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  const cause = value instanceof Error ? value : undefined;
  return new AppError(
    ErrorCode.Internal,
    "An unexpected error occurred",
    cause ? { cause, details: { name: cause.name } } : undefined,
  );
}
