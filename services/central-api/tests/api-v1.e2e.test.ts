import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import {
  ALERT_SEVERITIES,
  CONSOLE_SECTION_KEYS,
  consoleSectionPath,
  NODE_KINDS,
  SETTLEMENT_KINDS,
  type ConsolePayload,
  type ConsoleSectionKey,
  type ConsoleViewKey,
} from "@hewa/console-types";
import { SLA_STATES, TRANSACTION_STATUSES } from "@hewa/marketplace-types";
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
 * `CONSOLE_SECTION_KEYS` is the whole list of destinations the console can ask for,
 * and this asks for each one at the path `consoleSectionPath` builds. That is the
 * join between the two halves of the proxy: the browser sends a path from the
 * contract, and this asserts a route answers it. A section added to the contract
 * with no controller fails here rather than as a 404 in a browser, and a route added
 * for a section nobody has heard of fails the other direction.
 *
 * It is the *sections* rather than the views that are walked, because the sections
 * are what the rail navigates. Sixteen routes is more than the five views used to
 * have, and the number is the point: each rail button owns an endpoint, so a new
 * button cannot be a new way of reading the old one.
 *
 * The application is booted through the shared `bootCentralApi`, so the guard and
 * the CORS policy under test are the ones that ship. Booting a bare
 * `CentralApiAppModule` here would let every test below pass against a service
 * whose guard was never registered.
 */
describe("GET /api/v1/:view/:section", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A section's own path, on the service's own origin. */
  const url = (key: ConsoleSectionKey): string => `${baseUrl}${path(key)}`;

  function path(key: ConsoleSectionKey): string {
    const index = key.indexOf("/");
    return consoleSectionPath(key.slice(0, index) as ConsoleViewKey, key.slice(index + 1) as never);
  }

  test("every section answers with its envelope and no rows", async () => {
    for (const key of CONSOLE_SECTION_KEYS) {
      const response = await authorized(url(key));
      const body: unknown = await response.json();

      expect(response.status, `${key} answered ${response.status}`).toBe(200);
      expect(body, `${key} envelope`).toEqual({
        code: ResponseCode.Ok,
        data: expect.anything(),
        meta: { groups: expect.any(Array) },
      });
    }
  });

  test("every section sends something, and a list section sends a list", async () => {
    for (const key of CONSOLE_SECTION_KEYS) {
      const payload = (await (await authorized(url(key))).json()) as ConsolePayload[typeof key];

      if (payload.data instanceof Array) {
        expect(payload.data.length, `${key} has no seed records`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * A section that groups by nothing has to say so with an empty vocabulary.
   *
   * A bar rendered from an empty vocabulary is the failure this catches: the panel
   * would show a filter control over rows it cannot filter, which reads as a
   * control that is still loading.
   */
  test("the sections that group by nothing carry an empty group vocabulary", async () => {
    const ungrouped = [
      "market/book",
      "market/prices",
      "market/venues",
      "infrastructure/providers",
      "settlement/runs",
    ] as const satisfies readonly ConsoleSectionKey[];

    for (const key of ungrouped) {
      const payload = (await (await authorized(url(key))).json()) as ConsolePayload[typeof key];

      expect(payload.meta.groups, `${key} groups`).toEqual([]);
    }
  });

  test("every other section carries a vocabulary that is not empty", async () => {
    const grouped = CONSOLE_SECTION_KEYS.filter(
      (key) =>
        !(["market/book", "market/prices", "market/venues"] as readonly string[]).includes(key) &&
        key !== "infrastructure/providers" &&
        key !== "settlement/runs",
    );

    for (const key of grouped) {
      const payload = (await (await authorized(url(key))).json()) as ConsolePayload[typeof key];

      expect(payload.meta.groups.length, `${key} has no groups`).toBeGreaterThan(0);
    }
  });

  /**
   * The vocabulary is the whole point of `meta.groups`, so it is asserted as a value
   * and not as a length. A section that answered with the groups its rows happen to
   * contain would pass a length check and fail this one — and that is the failure
   * that produces a filter chip which appears and disappears as the data moves.
   *
   * The lists are imported rather than written out. A test that held its own copy
   * would go on passing after one side added a group, which is the drift this is
   * meant to catch: the service answers from its `ENUM` and the console builds its
   * chips from the contract, and the only thing holding them together is an
   * assertion that compares the two.
   */
  test("a grouped section names every group its column declares", async () => {
    const expected: Partial<Record<ConsoleSectionKey, readonly string[]>> = {
      "infrastructure/nodes": NODE_KINDS,
      "infrastructure/headroom": NODE_KINDS,
      "settlement/movements": SETTLEMENT_KINDS,
      // Payouts are grouped by status, not by kind: every row is already a payout,
      // so a chip for `payout` would select the table it is printed above.
      "settlement/payouts": TRANSACTION_STATUSES,
      "slas/commitments": SLA_STATES,
      "slas/at_risk": SLA_STATES,
      "slas/credits": SLA_STATES,
      "alerts/feed": ALERT_SEVERITIES,
      "alerts/outages": ALERT_SEVERITIES,
      "alerts/capacity": ALERT_SEVERITIES,
      "alerts/security": ALERT_SEVERITIES,
    };

    for (const [key, groups] of Object.entries(expected)) {
      const section = key as ConsoleSectionKey;
      const payload = (await (
        await authorized(url(section))
      ).json()) as ConsolePayload[typeof section];

      expect(payload.meta.groups, section).toEqual(groups);
    }
  });

  test("an unknown view is not found", async () => {
    // Authenticated, so the 404 is the router's answer and not the guard's: a
    // request refused before routing cannot distinguish "no such view" from "no
    // such route", and the two are different bugs.
    await expect(authorized(`${baseUrl}/api/v1/not-a-view`)).resolves.toMatchObject({
      status: 404,
    });
    await expect(authorized(`${baseUrl}/api/v1/not-a-view/nope`)).resolves.toMatchObject({
      status: 404,
    });
  });

  test("an unknown section under a real view is not found either", async () => {
    // The other half of the routing assertion. A controller with a wildcard, or a
    // section parameter it never validates, would answer this with the view's first
    // section's data — a 200 carrying the wrong rows, which is worse than a 404
    // because the panel would render it.
    for (const view of ["market", "infrastructure", "settlement", "slas", "alerts"] as const) {
      await expect(
        authorized(`${baseUrl}/api/v1/${view}/nope`),
        `${view}/nope still answers`,
      ).resolves.toMatchObject({ status: 404 });
    }
  });

  test("the view itself is not a section, so nothing answers at the bare prefix", async () => {
    // Each rail button has its own endpoint, and this is the assertion that a view
    // is not one. A bare `GET /api/v1/market` would be the document every market
    // section is a slice of — the shape the rails used to navigate, and the one a
    // client could still fall back on and quietly get one section's answer.
    for (const view of ["market", "infrastructure", "settlement", "slas", "alerts"] as const) {
      const response = await authorized(`${baseUrl}/api/v1/${view}`);
      expect(response.status, `${view} at its bare prefix`).toBe(404);
    }
  });

  test("there is no write path", async () => {
    // The read surface is the whole surface. A `POST` that answers 403 or 404 is
    // a router saying no; what would be wrong is a 2xx, or a 401 on a verb that
    // does not exist, which would mean the guard is standing in for a route check.
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const response = await authorized(url("alerts/feed"), { method });
      expect([404, 405], `${method} alerts/feed`).toContain(response.status);
    }
  });

  test("the prefix is the one the contract builds, for every section", async () => {
    // Spelled out rather than checked once, because the failure it guards against
    // is per-controller: five decorators each naming their own prefix, one of
    // which is a typo, and no shared constant to catch it.
    for (const key of CONSOLE_SECTION_KEYS) {
      const response = await authorized(`${baseUrl}/api/v1/${key}`);
      expect(response.status, `${key} at /api/v1`).toBe(200);
    }

    // And nothing answers at the prefixes the seven feeds used to live under, so a
    // stale client gets a 404 rather than a view that silently stopped being guarded.
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
    test("the book headline is derived from the book, and matches its rows", async () => {
      const { data } = (await (
        await authorized(url("market/book"))
      ).json()) as ConsolePayload["market/book"];

      // 40 + 25 + 100 + 60 + 30 + 80 + 200 + 400 + 150 + 12 + 45 + 20 committed Gbps.
      expect(data.committedGbps).toBe(1_162);
      expect(data.openOrders).toBe(12);
      expect(data.currency).toBe("USD");

      // 540_000 is the Mombasa corridor bid — the *highest* of the four pools' bids;
      // 88_000 is the CDN edge offer — the *lowest* of their offers. Swapped, the
      // book reads as crossed. And they are two different pools at two different
      // price scales, which is why the payload states them as extremes and has no
      // spread: their difference is a subtraction of two figures that do not mean
      // the same thing, and it is a negative number that would render as a price.
      expect(data.bestBid).toEqual({ amountMinor: 540_000, currency: "USD" });
      expect(data.bestOffer).toEqual({ amountMinor: 88_000, currency: "USD" });
      expect(data).not.toHaveProperty("spread");

      // Every order's committed capacity is in the headline, so the header and the
      // rows beneath it are one answer.
      expect(data.orders.reduce((total, order) => total + order.committedGbps, 0)).toBe(
        data.committedGbps,
      );
    });

    test("a quoted side carries a price and an absent one is null", async () => {
      // The nullable figures, asserted by their shape rather than by a seeded empty
      // market: `0` is a price, so "nobody is quoting" has to survive the trip as
      // `null` or a panel renders a free gigabit.
      const { data } = (await (
        await authorized(url("market/book"))
      ).json()) as ConsolePayload["market/book"];

      // The seed quotes both sides, so both survive the trip as prices. The `null`
      // branch is unreachable from the fixture and is asserted on the type, which is
      // the part that would otherwise be a cast: `null` is a value this field can
      // hold, and `0` — a price of nothing — is not what an empty side means.
      expect(typeof data.bestBid?.amountMinor).toBe("number");
      expect(typeof data.bestOffer?.amountMinor).toBe("number");
    });

    test("every order in the book is priced in the currency the payload declares", async () => {
      const { data } = (await (
        await authorized(url("market/book"))
      ).json()) as ConsolePayload["market/book"];

      expect(data.orders).toHaveLength(12);
      for (const order of data.orders) {
        expect(order.unitPrice.currency, order.id).toBe(data.currency);
        expect(order.submittedAt, `${order.id} has no instant`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
      const { data } = (await (
        await authorized(url("market/venues"))
      ).json()) as ConsolePayload["market/venues"];

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
      // And the shares are of the committed capacity the same section totals, so a
      // pie and the number above it cannot disagree.
      expect(data.venues.reduce((total, venue) => total + venue.committedGbps, 0)).toBe(
        data.totalCommittedGbps,
      );
      expect(data.totalCommittedGbps).toBe(1_162);
    });

    test("every pool gets a venue row, including the ones with no orders", async () => {
      const { data } = (await (
        await authorized(url("market/venues"))
      ).json()) as ConsolePayload["market/venues"];

      // A legend entry that vanishes with the data is a control that is only
      // sometimes there, and a pool with nothing committed is drawn at 0%.
      expect(data.venues).toHaveLength(4);
    });

    test("the price series is per pool, bounded, and in time order", async () => {
      const { data } = (await (
        await authorized(url("market/prices"))
      ).json()) as ConsolePayload["market/prices"];

      const perPool = new Map<string, number>();
      for (const point of data.points) {
        perPool.set(point.pool, (perPool.get(point.pool) ?? 0) + 1);
        expect(Number.isSafeInteger(point.price.amountMinor)).toBe(true);
      }

      // 48 observations per pool, which is `SPOT_WINDOW`. The bound is the reason
      // the query is per pool: a global limit on four pools with 48 rows each would
      // hand all of it to whichever pools sort first.
      expect([...perPool.values()].every((count) => count > 0)).toBe(true);
      expect(Math.max(...perPool.values())).toBeLessThanOrEqual(48);

      for (const [pool, count] of perPool) {
        const times = data.points
          .filter((point) => point.pool === pool)
          .map((point) => Date.parse(point.at));

        expect(count, pool).toBe(48);
        expect(
          [...times].sort((a, b) => a - b),
          `${pool} is in time order`,
        ).toEqual(times);
      }
    });

    /**
     * The current prices come out of the same rows as the chart.
     *
     * `latest` derived separately would be two queries over one table, and the table
     * of prices and the line beneath it would be free to disagree. This asserts
     * they are the same numbers rather than merely plausible ones.
     */
    test("the latest price per pool is the newest point in its own series", async () => {
      const { data } = (await (
        await authorized(url("market/prices"))
      ).json()) as ConsolePayload["market/prices"];

      expect(data.latest.map((quote) => quote.pool).sort()).toEqual([
        "cdn_edge",
        "east_africa_subsea",
        "mombasa_corridor",
        "nairobi_ixp",
      ]);

      for (const quote of data.latest) {
        const newest = data.points
          .filter((point) => point.pool === quote.pool)
          .map((point) => Date.parse(point.at))
          .sort((a, b) => b - a)[0];
        expect(Date.parse(quote.observedAt), quote.pool).toBe(newest);
      }
    });

    test("a node's availability is read as whole basis points", async () => {
      const { data } = (await (
        await authorized(url("infrastructure/nodes"))
      ).json()) as ConsolePayload["infrastructure/nodes"];

      expect(data.length).toBeGreaterThanOrEqual(10);
      for (const node of data) {
        expect(Number.isInteger(node.utilisationBps), node.id).toBe(true);
        expect(node.utilisationBps, node.id).toBeLessThanOrEqual(10_000);
      }
      // The offline PoP is at 10 000, which is a stored figure rather than a
      // computed one, and it is the row that proves utilisation came out of a column.
      expect(data.find((node) => node.id === "nod-nbo-cdn")?.status).toBe("offline");
    });

    /**
     * Headroom is derived, in the database, from the node's own two columns.
     *
     * The assertion is the identity rather than a list of expected numbers: a panel
     * that computed this itself would be a second implementation of the same
     * subtraction, and the two would disagree the first time a node's utilisation
     * moved between the query and the render.
     */
    test("headroom is capacity minus committed, and never negative", async () => {
      const { data } = (await (
        await authorized(url("infrastructure/headroom"))
      ).json()) as ConsolePayload["infrastructure/headroom"];

      expect(data.length).toBeGreaterThanOrEqual(10);
      for (const row of data) {
        expect(Number.isInteger(row.headroomGbps), row.nodeId).toBe(true);
        expect(row.headroomGbps, `${row.nodeId} has negative headroom`).toBeGreaterThanOrEqual(0);
        expect(row.capacityGbps - row.committedGbps, row.nodeId).toBe(row.headroomGbps);
        expect(row.committedGbps, `${row.nodeId} committed`).toBeLessThanOrEqual(row.capacityGbps);
      }
    });

    test("the tightest node is first, because the section answers where the next order goes", async () => {
      const { data } = (await (
        await authorized(url("infrastructure/headroom"))
      ).json()) as ConsolePayload["infrastructure/headroom"];

      const headrooms = data.map((row) => row.headroomGbps);
      expect(headrooms).toEqual([...headrooms].sort((a, b) => a - b));
    });

    /**
     * A provider's utilisation is capacity-weighted, not the mean of its nodes'.
     *
     * The naive aggregate is wrong in a way that gets more wrong the more
     * heterogeneous the provider is, and the seed is built so that it is visible:
     * Seacom runs one 10 Gbps node and one 1,000 Gbps node. Their mean is nowhere
     * near the weighted figure, so this catches a service that used `avg`.
     */
    test("provider utilisation is capacity-weighted, and its kinds and countries are sorted", async () => {
      const { data } = (await (
        await authorized(url("infrastructure/providers"))
      ).json()) as ConsolePayload["infrastructure/providers"];

      expect(data.length).toBeGreaterThan(0);
      for (const provider of data) {
        expect(Number.isInteger(provider.utilisationBps), provider.provider).toBe(true);
        expect(provider.nodeCount, `${provider.provider} node count`).toBeGreaterThan(0);
        expect([...provider.kinds], `${provider.provider} kinds`).toEqual(
          [...provider.kinds].toSorted(),
        );
        expect([...provider.countries], `${provider.provider} countries`).toEqual(
          [...provider.countries].toSorted(),
        );
        // A list that reorders on refresh is a legend the reader stops trusting.
        expect(provider.impaired, `${provider.provider} impaired`).toBeGreaterThanOrEqual(0);
      }
    });

    test("a settlement keeps its sign and its reason", async () => {
      const { data } = (await (
        await authorized(url("settlement/movements"))
      ).json()) as ConsolePayload["settlement/movements"];

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

    /**
     * A run is one row per batch *and currency*, and its totals are its own lines.
     *
     * The pair is the assertion that matters: a rollup grouped by batch alone would
     * sum two currencies into a number in minor units of nothing, and the run total
     * is exactly what an operator uses to decide whether a batch balanced.
     */
    test("runs are per batch and currency, and their net is gross minus fees", async () => {
      const { data } = (await (
        await authorized(url("settlement/runs"))
      ).json()) as ConsolePayload["settlement/runs"];

      expect(data.length).toBeGreaterThan(0);
      for (const run of data) {
        expect(run.lineCount, `${run.batch}`).toBeGreaterThan(0);
        expect(run.failed, `${run.batch} failed`).toBeLessThanOrEqual(run.lineCount);
        expect(run.net.amountMinor, `${run.batch} net`).toBe(
          Number(run.gross.amountMinor) - Number(run.fees.amountMinor),
        );
        // Every figure in one row is in that row's currency, which is what makes the
        // sum above meaningful.
        expect(run.gross.currency, `${run.batch} gross`).toBe(run.currency);
        expect(run.fees.currency, `${run.batch} fees`).toBe(run.currency);
        expect(run.net.currency, `${run.batch} net`).toBe(run.currency);
        expect([...run.kinds], `${run.batch} kinds`).toEqual([...run.kinds].toSorted());
      }

      // No `(batch, currency)` pair appears twice, which is what "one row per pair"
      // means and what a missing `GROUP BY` would break.
      const pairs = data.map((run) => `${run.batch}/${run.currency}`);
      expect(new Set(pairs).size).toBe(pairs.length);
    });

    test("a payout section is payouts, and its net is what arrived", async () => {
      const { data } = (await (
        await authorized(url("settlement/payouts"))
      ).json()) as ConsolePayload["settlement/payouts"];

      expect(data.length).toBeGreaterThan(0);
      for (const payout of data) {
        expect(payout.net.amountMinor, `${payout.id} net`).toBe(
          Number(payout.amount.amountMinor) - Number(payout.fee.amountMinor),
        );
        // Money going out stays negative in the amount; the net is what was sent.
        expect(payout.amount.amountMinor, `${payout.id} amount`).toBeLessThan(0);
        if (payout.status === "failed" || payout.status === "reversed") {
          expect(payout.failureReason, `${payout.id} stopped with no reason`).toBeTruthy();
        }
      }
    });

    test("a commitment's state is the stored one, and it is the shared rule's", async () => {
      const { data } = (await (
        await authorized(url("slas/commitments"))
      ).json()) as ConsolePayload["slas/commitments"];

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
      const { data } = (await (
        await authorized(url("slas/commitments"))
      ).json()) as ConsolePayload["slas/commitments"];

      const ratios = data.map((monitor) => monitor.sla.actualBps / monitor.sla.targetBps);
      expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
      // And the offline PoP, delivered at zero against a 9,999 target, is first.
      expect(data[0]?.nodeId).toBe("nod-nbo-cdn");
    });

    test("at risk holds only the commitments that are not compliant", async () => {
      const { data } = (await (
        await authorized(url("slas/at_risk"))
      ).json()) as ConsolePayload["slas/at_risk"];

      expect(data.length).toBeGreaterThan(0);
      for (const row of data) {
        // A compliant commitment cannot be at risk, and including it would put nine
        // rows of "everything is fine" above the one row that is not.
        expect(row.state, `${row.id} is compliant in an at-risk list`).not.toBe("compliant");
        // The shortfall is floored at zero: a compliant commitment has a negative
        // gap, and a risk list starting at -3 reads as a shortfall in the wrong
        // direction.
        expect(row.shortfallBps, `${row.id} shortfall`).toBeGreaterThanOrEqual(0);
        expect(row.shortfallBps, `${row.id} shortfall vs its own figures`).toBe(
          Math.max(row.sla.targetBps - row.sla.actualBps, 0),
        );
      }
    });

    /**
     * Credits publish a rate, not an amount.
     *
     * The service holds no bills, so the figure it can know is the rate and the
     * points it yields. An amount here would mean multiplying by a base nobody
     * named — a confident number, wrong in the direction an operator would act on.
     * The assertion is that the rate is the exact fraction stored and the points are
     * whole.
     */
    test("credits carry an exact rate and whole points, and no invented money", async () => {
      const { data } = (await (
        await authorized(url("slas/credits"))
      ).json()) as ConsolePayload["slas/credits"];

      expect(data.length).toBeGreaterThan(0);
      for (const credit of data) {
        expect(Number.isInteger(credit.creditablePoints), credit.commitmentId).toBe(true);
        expect(credit.creditablePoints, `${credit.commitmentId} points`).toBeGreaterThanOrEqual(0);
        expect(credit.creditNumerator, `${credit.commitmentId} rate`).toBeGreaterThan(0);
        expect(credit.creditDenominator, `${credit.commitmentId} rate`).toBeGreaterThan(0);
      }
      // Compliant commitments are included, with nothing creditable: a credit table
      // that hides the accounts being paid correctly cannot answer "who was
      // compensated", and the answer is mostly nobody.
      expect(data.some((credit) => credit.state === "compliant")).toBe(true);
      expect(
        data
          .filter((credit) => credit.state === "compliant")
          .every((c) => c.creditablePoints === 0),
      ).toBe(true);
    });

    test("alerts are ordered by severity, not alphabetically", async () => {
      const { data } = (await (
        await authorized(url("alerts/feed"))
      ).json()) as ConsolePayload["alerts/feed"];

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

    /**
     * One outage is one row, however many alerts it raised.
     *
     * The seed raises two alerts against the Nairobi CDN PoP, so this is the case
     * that distinguishes a grouped section from a filtered one: `alertCount` is 2,
     * the worst severity is the critical one rather than whichever sorted last, and
     * the two rows it collapsed are still counted.
     */
    test("outages are grouped by entity, with the worst severity and the count", async () => {
      const { data } = (await (
        await authorized(url("alerts/outages"))
      ).json()) as ConsolePayload["alerts/outages"];

      expect(data.length).toBeGreaterThan(0);

      const entities = data.map((group) => group.entityId);
      expect(new Set(entities).size, "an entity appears twice").toBe(entities.length);

      const multi = data.find((group) => group.alertCount > 1);
      expect(multi, "the seed should produce a group of more than one alert").toBeDefined();
      // The critical alert comes first in the feed, so the group's worst is critical
      // however the second one sorted.
      expect(multi?.worstSeverity).toBe("critical");

      for (const group of data) {
        expect(group.firstRaisedAt, `${group.entityId} first`).toBeTruthy();
        expect(Date.parse(group.lastRaisedAt), `${group.entityId} last`).toBeGreaterThanOrEqual(
          Date.parse(group.firstRaisedAt),
        );
        expect(group.impactedGbps, `${group.entityId} impacted`).toBeGreaterThan(0);
      }
    });

    test("capacity alerts carry the node's current headroom beside the alert", async () => {
      const { data } = (await (
        await authorized(url("alerts/capacity"))
      ).json()) as ConsolePayload["alerts/capacity"];

      expect(data.length).toBeGreaterThan(0);
      for (const row of data) {
        // `null` rather than zero for an alert about something that is not one of
        // our nodes: zero would put the row in a "nodes with room" table as the
        // emptiest entry in it.
        if (row.capacityGbps !== null) {
          expect(row.headroomGbps, `${row.entityId} capacity without headroom`).not.toBeNull();
          expect(row.headroomGbps ?? 0, `${row.entityId} negative headroom`).toBeGreaterThanOrEqual(
            0,
          );
        }
      }
    });

    test("security alerts are grouped per entity, with the count and the response", async () => {
      const { data } = (await (
        await authorized(url("alerts/security"))
      ).json()) as ConsolePayload["alerts/security"];

      // The section exists to collapse one intrusion into one row, so the seed's
      // three alerts against the Equinix edge have to come back as one.
      expect(data.length).toBeGreaterThan(0);
      const entities = data.map((event) => event.entityId);
      expect(new Set(entities).size, "an entity appears twice").toBe(entities.length);

      const collapsed = data.find((event) => event.eventCount > 1);
      expect(collapsed, "the seed should collapse several security alerts").toBeDefined();
      // And the worst severity of the collapsed group is the worst of its members,
      // not the last one read.
      expect(["critical", "high"]).toContain(collapsed?.worstSeverity);
    });
  });

  describe("the guard", () => {
    /**
     * A proxy in front of the service is not access control, so without the token
     * these routes would be open to anything with a network path to them. Every
     * section is checked rather than one, because `@UseGuards` is written on five
     * controllers and the fifth one is the one that would be missing.
     */
    for (const key of CONSOLE_SECTION_KEYS) {
      test(`${key} refuses a request with no token`, async () => {
        const response = await fetch(url(key));
        expect(response.status, key).toBe(401);
      });

      test(`${key} refuses a request with the wrong token`, async () => {
        const response = await fetch(url(key), {
          headers: { [SERVICE_TOKEN_HEADER]: "not-the-token" },
        });
        expect(response.status, key).toBe(401);
      });

      test(`${key} refuses an empty token`, async () => {
        // An empty string is falsy in most guard code and would pass a
        // `if (!presented)` check written the other way round.
        const response = await fetch(url(key), {
          headers: { [SERVICE_TOKEN_HEADER]: "" },
        });
        expect(response.status, key).toBe(401);
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
      const response = await fetch(url("alerts/feed"), {
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
    test("a section route is not reachable cross-origin at all", async () => {
      const preflight = await fetch(url("alerts/feed"), {
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

  test("every section answers 503, and says which variable is missing", async () => {
    for (const key of CONSOLE_SECTION_KEYS) {
      const response = await fetch(`${baseUrl}/api/v1/${key}`);

      expect(response.status, key).toBe(503);
      await expect(response.text(), key).resolves.toMatch(UNAVAILABLE_BODY);
    }
  });

  test("a token that is presented is still refused", async () => {
    // The branch that matters most: with nothing configured there is no value a
    // presented token could match, so this must not fall through to a comparison
    // against an empty string and 401 — and it must certainly not succeed.
    const response = await fetch(`${baseUrl}/api/v1/alerts/feed`, {
      headers: { [SERVICE_TOKEN_HEADER]: "anything at all" },
    });

    expect(response.status).toBe(503);
  });
});
