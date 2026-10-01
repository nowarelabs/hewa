import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import {
  ALERT_SEVERITIES,
  CONSOLE_VIEWS,
  consolePath,
  NODE_KINDS,
  SETTLEMENT_KINDS,
  type ConsolePayload,
  type ConsoleViewKey,
  type MarketSection,
} from "@hewa/console-types";
import { SLA_STATES } from "@hewa/marketplace-types";
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

  /**
   * One labelled figure out of a market section.
   *
   * Read back out of the formatted string rather than from a typed field, because
   * `MarketFigure.value` is pre-formatted by design — the assertion that the
   * headline total and the section totals agree has to go through the same
   * formatting the panel draws, or it is not testing the panel's number.
   */
  const figure = (section: MarketSection, label: string): string =>
    section.figures.find((entry) => entry.label === label)?.value ?? "";

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
    // `market` is the only view whose payload is a document rather than a list, so
    // it is the only one whose bar is built from something other than its rows. The
    // check is that it says so with `[]` — a bar that rendered four chips from an
    // empty vocabulary would be a control invented from nothing.
    for (const view of ["market"] as const) {
      const payload = (await (await authorized(url(view))).json()) as ConsolePayload[typeof view];

      expect(payload.meta.groups, `${view} groups`).toEqual([]);
    }
  });

  test("the four grouped views carry a vocabulary that is not empty", async () => {
    const grouped = ["infrastructure", "settlement", "slas", "alerts"] as const;

    for (const view of grouped) {
      const payload = (await (await authorized(url(view))).json()) as ConsolePayload[typeof view];

      expect(payload.meta.groups.length, `${view} has no groups`).toBeGreaterThan(0);
    }
  });

  /**
   * The vocabulary is the whole point of `meta.groups`, so it is asserted as a value
   * and not as a length. A view that answered with the groups its rows happen to
   * contain would pass a length check and fail this one — and that is the failure
   * that produces a filter chip which appears and disappears as the data moves.
   */
  test("a grouped view names every group its column declares", async () => {
    // The lists are imported rather than written out. A test that held its own
    // copy of the four vocabularies would go on passing after one side added a
    // group, which is the drift this is meant to catch: the service answers from
    // its `ENUM` and the console builds its chips from the contract, and the only
    // thing that holds them together is an assertion that compares the two.
    const expected: Record<Exclude<ConsoleViewKey, "market">, readonly string[]> = {
      infrastructure: NODE_KINDS,
      settlement: SETTLEMENT_KINDS,
      slas: SLA_STATES,
      alerts: ALERT_SEVERITIES,
    };

    for (const [view, groups] of Object.entries(expected)) {
      const payload = (await authorized(url(view as ConsoleViewKey))).json() as Promise<
        ConsolePayload[Exclude<ConsoleViewKey, "market">]
      >;
      const resolved = await payload;

      expect(resolved.meta.groups, view).toEqual(groups);
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

    // And nothing answers at the prefix these views used to live under, so a stale
    // client gets a 404 rather than a view that silently stopped being guarded.
    for (const gone of ["conflicts", "flights", "osint", "satellites", "streams", "economic"]) {
      await expect(
        authorized(`${baseUrl}/api/v1/${gone}`),
        `${gone} still answers`,
      ).resolves.toMatchObject({ status: 404 });
    }
  });

  /**
   * What the database actually said.
   *
   * Everything above checks the *shape* of a response. This checks that the numbers
   * in it came from rows and were derived, because the alternative failure is a
   * service that answers a well-formed envelope full of literals — which is exactly
   * what this service used to do, and which every shape assertion in this file would
   * have accepted.
   *
   * The expected values are written out rather than recomputed from the fixture. A
   * test that recomputed them would agree with any implementation of the same rule,
   * including the wrong one; these are the figures of `seedRows` as a reader adds
   * them up by hand.
   */
  describe("the rows it selects", () => {
    test("the market headline is derived from the book, and matches the sections", async () => {
      const { data } = (await (await authorized(url("market"))).json()) as ConsolePayload["market"];

      // 40 + 25 + 100 + 60 + 30 + 80 + 200 + 400 + 150 + 12 + 45 + 20 committed Gbps.
      expect(data.committedGbps).toBe(1_162);
      expect(data.openOrders).toBe(12);
      expect(data.currency).toBe("USD");

      // 540_000 is the Mombasa corridor bid; 88_000 is the CDN edge offer. The best
      // bid must be the *highest* of the four pools' bids and the best offer the
      // *lowest* of their offers — swapped, the book reads as crossed.
      expect(data.bestBid).toEqual({ amountMinor: 540_000, currency: "USD" });
      expect(data.bestOffer).toEqual({ amountMinor: 88_000, currency: "USD" });

      // And the headline is the same arithmetic as the rail beneath it, which is the
      // reason the service has one aggregate rather than two.
      const committed = data.sections.reduce(
        (total, section) =>
          total + Number(/^(\d+) Gbps$/.exec(figure(section, "Committed"))?.[1] ?? "0"),
        0,
      );
      expect(committed).toBe(data.committedGbps);
    });

    test("every pool gets a section, including the ones with no orders", async () => {
      const { data } = (await (await authorized(url("market"))).json()) as ConsolePayload["market"];

      expect(data.sections.map((section) => section.id)).toEqual([
        "nairobi_ixp",
        "mombasa_corridor",
        "east_africa_subsea",
        "cdn_edge",
      ]);
      for (const section of data.sections) {
        expect(section.title, section.id).toBeTruthy();
        expect(section.figures.length, section.id).toBeGreaterThan(0);
      }
    });

    /**
     * The largest-remainder rule, on numbers that would fail the naive version.
     *
     * 225, 110, 750 and 77 of 1,162 are 19.36%, 9.47%, 64.54% and 6.63%. Rounding
     * each independently gives 19 + 9 + 65 + 7 = 100 by luck here, so the assertion
     * that matters is the sum, held for whatever the seed says: a pie whose slices
     * do not fill the circle misreports its own data, and 100 is a promise the
     * contract makes.
     */
    test("the venue shares are whole numbers that add up to a hundred", async () => {
      const { data } = (await (await authorized(url("market"))).json()) as ConsolePayload["market"];

      expect(data.venues.map((venue) => venue.pool).sort()).toEqual([
        "cdn_edge",
        "east_africa_subsea",
        "mombasa_corridor",
        "nairobi_ixp",
      ]);
      for (const venue of data.venues) {
        expect(Number.isInteger(venue.share), `${venue.pool} share`).toBe(true);
      }
      expect(data.venues.reduce((points, venue) => points + venue.share, 0)).toBe(100);
    });

    test("the price series is per pool, bounded, and in time order", async () => {
      const { data } = (await (await authorized(url("market"))).json()) as ConsolePayload["market"];

      const perPool = new Map<string, number>();
      for (const point of data.priceSeries) {
        perPool.set(point.pool, (perPool.get(point.pool) ?? 0) + 1);
        expect(Number.isSafeInteger(point.price.amountMinor)).toBe(true);
      }

      // 48 observations per pool, which is `SPOT_WINDOW`. The bound is the reason
      // the query is per pool: a global limit on four pools with 48 rows each would
      // hand all of it to whichever pools sort first.
      expect([...perPool.values()].every((count) => count > 0)).toBe(true);
      expect(Math.max(...perPool.values())).toBeLessThanOrEqual(48);

      for (const [pool, count] of perPool) {
        const times = data.priceSeries
          .filter((point) => point.pool === pool)
          .map((point) => Date.parse(point.at));

        expect(count, pool).toBe(48);
        expect(
          [...times].sort((a, b) => a - b),
          `${pool} is in time order`,
        ).toEqual(times);
      }
    });

    test("every order in the book is priced in the currency the payload declares", async () => {
      const { data } = (await (await authorized(url("market"))).json()) as ConsolePayload["market"];

      expect(data.book).toHaveLength(12);
      for (const order of data.book) {
        expect(order.unitPrice.currency, order.id).toBe(data.currency);
        expect(order.submittedAt, `${order.id} has no instant`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    test("a node's availability is read as whole basis points", async () => {
      const { data } = (await (
        await authorized(url("infrastructure"))
      ).json()) as ConsolePayload["infrastructure"];

      expect(data.length).toBeGreaterThanOrEqual(10);
      for (const node of data) {
        expect(Number.isInteger(node.utilisationBps), node.id).toBe(true);
        expect(node.utilisationBps, node.id).toBeLessThanOrEqual(10_000);
      }
      // The offline PoP is at 10 000, which is a stored figure rather than a
      // computed one, and it is the row that proves utilisation came out of a column.
      expect(data.find((node) => node.id === "nod-nbo-cdn")?.status).toBe("offline");
    });

    test("a settlement keeps its sign and its reason", async () => {
      const { data } = (await (
        await authorized(url("settlement"))
      ).json()) as ConsolePayload["settlement"];

      // `failed` and `reversed` are the two statuses where value did not move, and
      // both say why. `completed` and `processing` never carry a reason: an empty
      // string there would render as the same dash as a `null` on a line that never
      // went wrong.
      const stopped = new Set(["failed", "reversed"]);

      expect(data.length).toBe(12);
      for (const line of data) {
        expect(line.fee.amountMinor, `${line.id} fee`).toBeGreaterThanOrEqual(0);
        if (stopped.has(line.status)) {
          expect(line.failureReason, `${line.id} is ${line.status} with no reason`).toBeTruthy();
        } else {
          expect(line.failureReason, `${line.id} is ${line.status} with a reason`).toBeNull();
        }
      }

      // A payout is money going out, so its amount is negative. This is the
      // assertion that the `bigint` column round-tripped through a JSON number with
      // its sign intact — an unsigned read would show a payout as income.
      const payout = data.find((line) => line.kind === "payout" && line.status === "completed");
      expect(payout?.amount.amountMinor).toBeLessThan(0);
    });

    test("a commitment's state is the stored one, and it is the shared rule's", async () => {
      const { data } = (await (await authorized(url("slas"))).json()) as ConsolePayload["slas"];

      expect(data.length).toBeGreaterThan(0);
      for (const monitor of data) {
        // Recomputing here is the point: the service sends a stored value, and this
        // says the stored value is still what the rule produces. A boundary moved in
        // `marketplace-types` without a migration fails here rather than in a credit.
        const shortfall = monitor.sla.targetBps - monitor.sla.actualBps;
        const expected = shortfall === 0 ? "compliant" : shortfall < 100 ? "at_risk" : "breached";

        expect(
          monitor.state,
          `${monitor.id} is ${monitor.sla.targetBps}/${monitor.sla.actualBps}`,
        ).toBe(expected);
        expect(monitor.sla.creditDenominator, `${monitor.id} has no credit rate`).toBeGreaterThan(
          0,
        );
      }
    });

    test("commitments are ordered worst first", async () => {
      const { data } = (await (await authorized(url("slas"))).json()) as ConsolePayload["slas"];

      const ratios = data.map((monitor) => monitor.sla.actualBps / monitor.sla.targetBps);
      expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
      // And the offline PoP, delivered at zero against a 9,999 target, is first.
      expect(data[0]?.nodeId).toBe("nod-nbo-cdn");
    });

    test("alerts are ordered by severity, not alphabetically", async () => {
      const { data } = (await (await authorized(url("alerts"))).json()) as ConsolePayload["alerts"];

      const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      expect(data.map((alert) => rank[alert.severity])).toEqual(
        data.map((alert) => rank[alert.severity]).sort((a, b) => a - b),
      );
      expect(data[0]?.severity).toBe("critical");

      for (const alert of data) {
        expect(alert.entityLabel, alert.id).toBeTruthy();
        expect(alert.impactedGbps, alert.id).toBeGreaterThanOrEqual(0);
      }
    });
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
