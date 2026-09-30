import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

import { SERVICE_TOKEN } from "./tokens.js";

/**
 * The header the Next app presents.
 *
 * A custom header rather than `Authorization: Bearer`, because a bearer token
 * read from a cookie or a session store is a user credential and this is not
 * one — there is no user behind it, and nothing here should be able to end up
 * holding one by accident. An `x-hewa-service-token` cannot be picked up by an
 * interceptor that forwards whatever it finds.
 */
export const SERVICE_TOKEN_HEADER = "x-hewa-service-token";

/**
 * Refuses a request that is not the web app.
 *
 * This guard is the reason `/api/v1` is not simply open, and the reasoning is
 * worth stating because the proxy in front of it is not the same thing. Routing
 * the browser's calls through a Next.js route handler hides the backend's address
 * and its token from page scripts, which is a real gain — but it is *not* access
 * control. CORS is enforced by browsers and not by this process, so a `curl`, a
 * misconfigured internal service, or anything else with a network route gets a
 * 200 from an unguarded `/api/v1`. Only a check on this side makes the claim
 * true.
 *
 * The comparison is constant-time. A token compared with `===` leaks its length
 * and its prefix through timing, which is a slow way to guess a secret but a real
 * one, and it costs one function call to not do it.
 *
 * ## No configured token is a 503, not a 401
 *
 * The interesting branch is the one before the comparison. `loadEnv` allows
 * `CENTRAL_API_SERVICE_TOKEN` to be absent so the process can start and `/health`
 * can answer, which means this guard sometimes runs with nothing to compare
 * against — and there is no answer to that request that involves letting it
 * through. There is also no answer that is a 401, because a 401 says "your token
 * is wrong", and the caller's token may be perfectly right: what is missing is
 * *this side's*. So it is a 503, and the message names the variable, because the
 * caller is the web app and the reader is whoever deployed it.
 *
 * A crash at boot would have been the alternative and would have been worse: no
 * process means no `/health`, so a container in this state reports unhealthy for
 * a reason its own logs do not explain.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  /**
   * `@Inject` and not a bare `string` parameter.
   *
   * Nest reads a constructor's parameter types off the emitted metadata, and an
   * unannotated `string` arrives as the class `String` — which it then tries to
   * resolve from the module graph, and there is no provider called `String`. The
   * annotation is what names the provider, and it is load-bearing rather than
   * decorative.
   */
  constructor(@Inject(SERVICE_TOKEN) private readonly expected: string | undefined) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const presented = request.headers[SERVICE_TOKEN_HEADER];

    if (this.expected === undefined) {
      // Before anything is read from the request, and before any comparison: with
      // nothing configured there is no value a presented token could match, so
      // reading it first would only mean there is one path where a request
      // reaches a comparison it should never reach.
      throw new ServiceUnavailableException(
        "central-api has no CENTRAL_API_SERVICE_TOKEN configured; copy .env.example to .env",
      );
    }

    if (typeof presented !== "string" || !this.matches(this.expected, presented)) {
      // `UnauthorizedError` would be the workspace's own, but Nest's guard
      // contract is an exception, and `UnauthenticatedError` carries 401 as well.
      // The message says nothing about the expected value.
      throw new UnauthorizedException("a valid service token is required");
    }
    return true;
  }

  private matches(expectedToken: string, presented: string): boolean {
    const expected = Buffer.from(expectedToken, "utf8");
    const actual = Buffer.from(presented, "utf8");
    // `timingSafeEqual` throws on a length mismatch, and a length mismatch is
    // itself the answer — so the length is compared first, with the same
    // reasoning a padding check has. What is not compared is how many leading
    // bytes agreed, which is what `===` would have leaked.
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  }
}

/** Re-exported so the module and the guard agree on one spelling. */
export { SERVICE_TOKEN } from "./tokens.js";
