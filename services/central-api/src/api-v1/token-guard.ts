import {
  ServiceUnavailableException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

/**
 * The one token comparison both guards perform.
 *
 * There are two guards — one for reads, one for writes — and the comparison they
 * share is the part that has to be right: constant-time, length-checked first,
 * and refusing everything when nothing is configured. Written out twice it would
 * be right twice until one of them was edited, and the edit that matters is the
 * one that drops `timingSafeEqual`.
 *
 * The three refusals, in the order they are checked:
 *
 * 1. **Nothing configured → 503.** `loadEnv` allows an absent token so the process
 *    can boot and `/health` can answer, which means a guard sometimes runs with no
 *    value to compare against, and there is no answer to that request involving
 *    letting it through. It is not a 401 either: a 401 says *your* token is wrong,
 *    and the caller's token may be perfectly right — what is missing is this
 *    side's. The message names the variable, because the caller is an internal app
 *    and the reader is whoever deployed it.
 * 2. **The header is absent, or not a string → 401.** `typeof` rather than truthiness:
 *    a repeated header arrives as an array, and an array is not something to
 *    compare against a secret.
 * 3. **The value differs → 401.** Length first, because `timingSafeEqual` throws on
 *    a mismatch and a length mismatch is itself the answer. `===` would leak the
 *    length and the prefix, which is a slow way to guess a secret but a real one.
 *
 * Reading the header happens after the configured check on purpose: with nothing
 * configured there is no value a presented token could match, so reading it first
 * would only mean there is one path where a request reaches a comparison it should
 * never reach.
 *
 * Neither message says anything about the expected value.
 */
export function assertPresentedToken(
  context: ExecutionContext,
  expected: string | undefined,
  header: string,
  variableName: string,
): void {
  if (expected === undefined) {
    throw new ServiceUnavailableException(
      `central-api has no ${variableName} configured; copy .env.example to .env`,
    );
  }

  const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
  const presented = request.headers[header];

  if (typeof presented !== "string" || !matches(expected, presented)) {
    // `UnauthorizedError` would be the workspace's own, but a guard's contract is an
    // exception, and Nest's `UnauthorizedException` carries the 401.
    throw new UnauthorizedException(
      `a valid ${variableName.toLowerCase().replace(/_/g, " ")} is required`,
    );
  }
}

/** Constant-time equality, with the length compared first because it must be. */
function matches(expectedToken: string, presented: string): boolean {
  const expected = Buffer.from(expectedToken, "utf8");
  const actual = Buffer.from(presented, "utf8");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}
