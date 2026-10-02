import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

import { assertPresentedToken } from "./token-guard.js";
import { WRITE_TOKEN } from "./tokens.js";

/**
 * The header a write presents.
 *
 * A second header rather than a second field in the first one, because the two
 * credentials are held by different parties and should not be substitutable. One
 * shared secret handed to the read path *and* the write path is a read-only
 * deployment that can write, and the only thing standing between that and a
 * vandalised order book is somebody remembering which variable went where.
 *
 * `x-hewa-write-token` rather than `Authorization` for the same reason the read
 * header is not one: a bearer credential is a user credential, and nothing here
 * has a user behind it.
 */
export const WRITE_TOKEN_HEADER = "x-hewa-write-token";

/**
 * Refuses a request that is not authorised to write.
 *
 * Separate from {@link ServiceTokenGuard} and applied to the write routes
 * **alongside** it, not instead of it: a write is a read of the record's previous
 * state as far as the caller is concerned, and the two guards answer different
 * questions. Both tokens therefore have to be present for a write, which is the
 * point — the read token is what the browser's proxy holds, and the write token
 * is what the operator's console presents, so a deployment can hand out the first
 * to a service that is only allowed to watch.
 *
 * The comparison is in `assertPresentedToken`, shared with the read guard.
 */
@Injectable()
export class WriteTokenGuard implements CanActivate {
  constructor(@Inject(WRITE_TOKEN) private readonly expected: string | undefined) {}

  canActivate(context: ExecutionContext): boolean {
    assertPresentedToken(context, this.expected, WRITE_TOKEN_HEADER, "CENTRAL_API_WRITE_TOKEN");
    return true;
  }
}
