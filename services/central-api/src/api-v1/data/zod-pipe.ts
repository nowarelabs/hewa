import { ValidationError } from "@hewa/errors";
import { type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * The zod issue, as the error's `details` carry it.
 *
 * Only what a form needs to point at a field: the path as a dotted string, the
 * message, and the code. A zod `issue` also carries the expected and received
 * values, and those are dropped deliberately — they are the body the caller just
 * sent, so putting them in the error means the error log holds a copy of a write
 * that included a counterparty's name and an amount. A field that failed with a
 * message saying what it wanted is enough to fix it.
 */
interface FieldIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Run a schema, or refuse with a `ValidationError`.
 *
 * One place that turns a zod failure into the workspace's error type, rather than a
 * `BadRequestException` from Nest in one handler and an `AppError` in the next: the
 * panel reads `code` and `details` to highlight fields, and a service that answers
 * failures two ways is one where the highlighting works on some routes.
 *
 * `ValidationFailed` is a 422 and not Nest's 400, deliberately. 400 says "the
 * request was malformed"; 422 says "it was well-formed and the content is wrong",
 * which is what a form sending `severity: Critical` is, and which is the difference
 * between a validation failure a client retries and one it reports.
 */
export function parseOrThrow<TSchema extends ZodType>(
  schema: TSchema,
  value: unknown,
  subject: string,
): ReturnType<TSchema["parse"]> {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data as ReturnType<TSchema["parse"]>;
  }

  const issues: FieldIssue[] = parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  throw new ValidationError(
    issues.length === 1 && issues[0]?.path !== ""
      ? `${subject}: ${issues[0]?.path} ${issues[0]?.message}`
      : `${subject} is not valid`,
    { issues },
  );
}

/**
 * A body, checked against a schema before the controller sees it.
 *
 * Used as `@Body(new ZodBody(createAlertSchema))`, so the handler's parameter is
 * the validated payload and its declared type is the contract's — the alternative
 * is a handler taking `unknown`, parsing it, and trusting that the parse is what
 * the caller thinks it is.
 */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly subject = "body",
  ) {}

  transform(value: unknown): T {
    return parseOrThrow(this.schema, value, this.subject);
  }
}

/**
 * A path parameter, checked against the same schemas as a body.
 *
 * Exists for one field — the id — and is here because a 200-character id should be
 * a 400 at the edge with a message naming the parameter, rather than a `value too
 * long` from the driver that the error filter opaques into a 500.
 */
export class ZodParam<T> implements PipeTransform<string, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly subject = "parameter",
  ) {}

  transform(value: unknown): T {
    return parseOrThrow(this.schema, value, this.subject);
  }
}
