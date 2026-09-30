import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

import { CentralApiAppModule } from "../src/app.module.js";
import { CentralApiErrorFilter } from "../src/common/error.filter.js";
import { corsDelegate } from "../src/config/cors.js";
import { loadEnv } from "../src/config/env.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";

/**
 * The token the e2e suite presents.
 *
 * Set on `process.env` before the application boots, because the guard reads the
 * token from the loaded environment at resolution time. A test cannot pass it in
 * as an argument: the point being tested is that a request with the wrong token is
 * refused, and a suite that configured its own token per test would be asserting
 * against whatever it just set rather than against the deploy's configuration.
 */
export const TEST_TOKEN = "e2e-service-token";

/** What a request with no token, or the wrong one, is refused with. */
export const UNAUTHORIZED_BODY = /service token is required/;

/** What a service with no token configured says, which is a different failure. */
export const UNAVAILABLE_BODY = /CENTRAL_API_SERVICE_TOKEN/;

export interface BootOptions {
  /**
   * The token to configure, or `null` to configure none.
   *
   * `null` boots a service with no `CENTRAL_API_SERVICE_TOKEN` at all, which is
   * the state a developer is in before copying `.env.example` to `.env`. It is
   * not reachable by clearing the variable after boot, because the guard reads it
   * once at resolution.
   */
  readonly serviceToken?: string | null;
}

/**
 * Boot the real application.
 *
 * The whole module graph, the global error filter, the guard, and the CORS
 * delegate — which is the only way to prove `/api/v1` is guarded at all, and that
 * each view's controller is reachable from the module that declares it. A unit
 * test of a controller would pass with the module graph broken and the guard
 * missing.
 */
export async function bootCentralApi(options: BootOptions = {}): Promise<INestApplication> {
  const token = options.serviceToken === undefined ? TEST_TOKEN : options.serviceToken;

  if (token === null) {
    delete process.env["CENTRAL_API_SERVICE_TOKEN"];
  } else {
    process.env["CENTRAL_API_SERVICE_TOKEN"] = token;
  }

  const moduleRef = await Test.createTestingModule({
    imports: [CentralApiAppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new CentralApiErrorFilter());
  // The real policy, not a copy of it. CORS is the one piece of this service's
  // behaviour that is decided in `main.ts`, and a suite that booted without it
  // would pass against a service that allowed every origin to read `/api/v1`.
  app.enableCors(corsDelegate(loadEnv().corsOrigins));
  await app.listen(0);
  return app;
}

/**
 * A `fetch` that already carries the token, for the common case.
 *
 * The caller's headers are normalised through `Headers` rather than spread, so
 * that a `Headers` or a list of pairs still works — a spread of either yields no
 * entries at all, which would quietly drop the caller's own headers.
 */
export function authorized(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(SERVICE_TOKEN_HEADER, TEST_TOKEN);
  return fetch(url, { ...init, headers });
}
