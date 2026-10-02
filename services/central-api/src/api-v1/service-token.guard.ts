import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

import { assertPresentedToken } from "./token-guard.js";
import { SERVICE_TOKEN } from "./tokens.js";

/**
 * The header the Next app presents to read.
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
 * The comparison itself is in `assertPresentedToken`, shared with the write guard:
 * see that function for why it is not written out twice.
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
    assertPresentedToken(context, this.expected, SERVICE_TOKEN_HEADER, "CENTRAL_API_SERVICE_TOKEN");
    return true;
  }
}

/** Re-exported so the module and the guard agree on one spelling. */
export { SERVICE_TOKEN } from "./tokens.js";
