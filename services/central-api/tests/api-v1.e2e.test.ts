import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import { CONSOLE_VIEWS, consolePath, type ConsolePayload } from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";

import {
  authorized,
  bootCentralApi,
  TEST_TOKEN,
  UNAUTHORIZED_BODY,
  UNAVAILABLE_BODY,
} from "./boot.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";

/**
 * The `/api/v1` read surface over real HTTP, and the guard in front of it.
 *
 * `CONSOLE_VIEWS` is the whole list of views the console can ask for, and this
 * asks for each one at the path `consolePath` builds. That is the join between
 * the two halves of the proxy: the browser sends a path from the contract, and
 * this asserts a route answers it. A view added to the contract with no module
 * fails here rather than as a 404 in a browser, and a route added for a view
 * nobody has heard of fails the other direction.
 *
 * The application is booted through the shared `bootCentralApi`, so the guard and
 * the CORS policy under test are the ones that ship. Booting a bare
 * `CentralApiAppModule` here would let every test below pass against a service
 * whose guard was never registered.
 */
describe("GET /api/v1/:view", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  /** The view's own path, on the service's own origin. */
  const url = (view: (typeof CONSOLE_VIEWS)[number]): string => `${baseUrl}${consolePath(view)}`;

  test("every view answers with its envelope and no rows", async () => {
    for (const view of CONSOLE_VIEWS) {
      const response = await authorized(url(view));
      const body: unknown = await response.json();

      expect(response.status, `${view} answered ${response.status}`).toBe(200);
      expect(body, `${view} envelope`).toEqual({
        code: ResponseCode.Ok,
        data: expect.anything(),
        meta: { groups: expect.any(Array) },
      });
    }
  });

  test("every view sends something, and a list view sends a list", async () => {
    for (const view of CONSOLE_VIEWS) {
      const payload = (await (await authorized(url(view))).json()) as ConsolePayload[typeof view];

      if (payload.data instanceof Array) {
        expect(payload.data.length, `${view} has no seed records`).toBeGreaterThan(0);
      }
    }
  });

  test("the one ungrouped view carries an empty group vocabulary", async () => {
    for (const view of ["economic"] as const) {
      const payload = (await (await authorized(url(view))).json()) as ConsolePayload[typeof view];

      expect(payload.meta.groups, `${view} groups`).toEqual([]);
    }
  });

  test("the six grouped views carry a vocabulary that is not empty", async () => {
    const grouped = ["alerts", "conflicts", "flights", "osint", "satellites", "streams"] as const;

    for (const view of grouped) {
      const payload = (await (await authorized(url(view))).json()) as ConsolePayload[typeof view];

      expect(payload.meta.groups.length, `${view} has no groups`).toBeGreaterThan(0);
    }
  });

  test("an unknown view is not found", async () => {
    // Authenticated, so the 404 is the router's answer and not the guard's: a
    // request refused before routing cannot distinguish "no such view" from "no
    // such route", and the two are different bugs.
    await expect(authorized(`${baseUrl}/api/v1/not-a-view`)).resolves.toMatchObject({
      status: 404,
    });
  });

  test("there is no write path", async () => {
    // The read surface is the whole surface. A `POST` that answers 403 or 404 is
    // a router saying no; what would be wrong is a 2xx, or a 401 on a verb that
    // does not exist, which would mean the guard is standing in for a route check.
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const response = await authorized(url("alerts"), { method });
      expect([404, 405], `${method} alerts`).toContain(response.status);
    }
  });

  test("the prefix is the one the contract builds, for every view", async () => {
    // Spelled out rather than checked once, because the failure it guards against
    // is per-controller: seven decorators each naming their own prefix, one of
    // which is a typo, and no shared constant to catch it.
    for (const view of CONSOLE_VIEWS) {
      const response = await authorized(`${baseUrl}/api/v1/${view}`);

      expect(response.status, `${view} at /api/v1`).toBe(200);
    }

    // And nothing answers at the old prefix, so a stale client gets a 404 rather
    // than a view that silently stopped being guarded.
    await expect(authorized(`${baseUrl}/console/alerts`)).resolves.toMatchObject({ status: 404 });
  });

  describe("the guard", () => {
    /**
     * A proxy in front of the service is not access control, so without the token
     * these routes would be open to anything with a network path to them. Every
     * view is checked rather than one, because `@UseGuards` is written seven times
     * and the seventh one is the one that would be missing.
     */
    for (const view of CONSOLE_VIEWS) {
      test(`${view} refuses a request with no token`, async () => {
        const response = await fetch(url(view));
        expect(response.status, view).toBe(401);
      });

      test(`${view} refuses a request with the wrong token`, async () => {
        const response = await fetch(url(view), {
          headers: { [SERVICE_TOKEN_HEADER]: "not-the-token" },
        });
        expect(response.status, view).toBe(401);
      });

      test(`${view} refuses an empty token`, async () => {
        // An empty string is falsy in most guard code and would pass a
        // `if (!presented)` check written the other way round.
        const response = await fetch(url(view), {
          headers: { [SERVICE_TOKEN_HEADER]: "" },
        });
        expect(response.status, view).toBe(401);
      });
    }

    test("health is not behind the guard, because a probe has no token", async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
    });

    test("a refused request does not say what the token is", async () => {
      // The guard's message is the only thing an attacker gets to read, and an
      // error that quoted the expected value — or the header name — would be a
      // hint delivered by the process whose job is not to give one.
      const response = await fetch(url("alerts"), {
        headers: { [SERVICE_TOKEN_HEADER]: "not-the-token" },
      });
      const text = await response.text();

      expect(text).toMatch(UNAUTHORIZED_BODY);
      expect(text).not.toContain(TEST_TOKEN);
      expect(text).not.toContain(SERVICE_TOKEN_HEADER);
    });
  });

  describe("cors", () => {
    /**
     * The token guard is the lock. CORS is the door it sits behind, and a browser
     * that gets a successful preflight against `/api/v1` has learned the route
     * exists before it has been refused. These assert the scoping, because an
     * `enableCors` call with no `delegate` is global and would pass every other
     * test in this file while quietly reopening exactly the path the proxy exists
     * to close.
     */
    test("a view route is not reachable cross-origin at all", async () => {
      const preflight = await fetch(url("alerts"), {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3005",
          "access-control-request-method": "GET",
        },
      });

      expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("an allowed origin may read health", async () => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { origin: "http://localhost:3005" },
      });

      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3005");
    });

    test("an origin that is not on the list may not read health either", async () => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { origin: "http://evil.example" },
      });

      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });
});

/**
 * A service with no token configured.
 *
 * The state a developer is in before copying `.env.example` to `.env`, which is
 * the state this used to refuse to boot from. Booting is what lets `/health`
 * answer and the console load, so the only thing that must be closed is the data.
 */
describe("a service with no CENTRAL_API_SERVICE_TOKEN", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi({ serviceToken: null });
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
    // Put the suite's default back, so a later file in the same worker that calls
    // `bootCentralApi` does not inherit a missing token and fail for a reason that
    // has nothing to do with it.
    process.env["CENTRAL_API_SERVICE_TOKEN"] = TEST_TOKEN;
  });

  test("it still starts, and health still answers", async () => {
    // The reason the token is not required at boot. A process that refused to
    // start would have no `/health`, so a container in this state would report
    // unhealthy for a reason its own logs do not explain.
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
  });

  test("every view answers 503, and says which variable is missing", async () => {
    for (const view of CONSOLE_VIEWS) {
      const response = await fetch(`${baseUrl}${consolePath(view)}`);

      expect(response.status, view).toBe(503);
      await expect(response.text(), view).resolves.toMatch(UNAVAILABLE_BODY);
    }
  });

  test("a token that is presented is still refused", async () => {
    // The branch that matters most: with nothing configured there is no value a
    // presented token could match, so this must not fall through to a comparison
    // against an empty string and 401 — and it must certainly not succeed.
    const response = await fetch(`${baseUrl}${consolePath("alerts")}`, {
      headers: { [SERVICE_TOKEN_HEADER]: "anything at all" },
    });

    expect(response.status).toBe(503);
  });
});
