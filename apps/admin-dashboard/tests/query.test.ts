// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ResponseCode } from "@hewa/response-codes";
import { MARKET_POOL_TITLES } from "@hewa/console-types";

import { useAlertFeed } from "../src/app/data/alerts";
import { useNodes } from "../src/app/data/infrastructure";
import { useMarketBook } from "../src/app/data/market";
import { emptyMessage } from "../src/app/ui/primitives";
import { consoleFixtures } from "./fixtures";
import { emptyQueryClient } from "./harness";

/**
 * What the app does while waiting for an answer.
 *
 * Every panel read from a constant before this, so there was no "while waiting"
 * to get wrong: the rows were there before the first render and nothing could
 * fail. Now there is, and three states render the same empty list — nothing asked
 * yet, nothing answered, and an answer that came back empty.
 *
 * That is the whole hazard. A panel that cannot tell them apart says "no alerts
 * match these severities" over a service that is down, and the operator goes
 * looking for a filter that is not the problem. So the hook reports a status, and
 * this file is what says it reports the right one in each case.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * What every one of these hooks reports, and the only field this file needs in
 * order to know a query has settled.
 *
 * The list hooks return `GroupedRowState` and the document hooks
 * `DocumentState`, and this is the shape they agree on — the part of it a test
 * about waiting can be written against without naming which of the two it is
 * holding.
 */
interface Probeable {
  readonly status: "pending" | "failed" | "ready";
}

/** Renders a section's hook and hands back whatever it last returned. */
function probe<T extends Probeable>(
  useSection: () => T,
): { read: () => T; flush: () => Promise<void>; cache: QueryClient } {
  let latest: T | undefined;
  const client = emptyQueryClient();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(function Probe(): ReactElement {
          latest = useSection();
          return createElement("div");
        }),
      ),
    );
  });

  return {
    cache: client,
    read: () => latest as T,
    /**
     * Waits for the query to settle.
     *
     * Draining the microtask queue a fixed number of times is a guess: React
     * Query resolves a fetch, then schedules its own notification, and the count
     * that happens to be enough is a property of its internals rather than of
     * anything written here. Waiting for the status to leave `pending` waits for
     * the thing the test is actually about.
     */
    flush: async () => {
      await act(async () => {
        await vi.waitFor(() => {
          expect(latest?.status).not.toBe("pending");
        });
      });
    },
  };
}

function serve(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json(payload))),
  );
}

function refuse(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("", { status }))),
  );
}

beforeEach(() => {
  // A fetch that never settles is the pending state, and it is the default so
  // that a test which does not say otherwise is testing the waiting case rather
  // than reaching the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("useConsoleSection", () => {
  test("reports pending and no rows before the service answers", () => {
    const { read } = probe(useAlertFeed);
    const section = read();

    expect(section.status).toBe("pending");
    expect(section.rows).toEqual([]);
    expect(section.groups).toEqual([]);
  });

  test("reports ready with the rows and the vocabulary the service sent", async () => {
    const payload = consoleFixtures["alerts/feed"];
    serve(payload);

    const { read, flush } = probe(useAlertFeed);
    await flush();

    const section = read();
    expect(section.status).toBe("ready");
    expect(section.rows).toEqual(payload.data);
    expect(section.groups).toEqual(payload.meta.groups);
  });

  test("reports failed when the service answers with an error status", async () => {
    refuse(503);

    const { read, flush } = probe(useAlertFeed);
    await flush();

    const section = read();
    expect(section.status).toBe("failed");
    expect(section.rows).toEqual([]);
  });

  test("an answer of an empty list is ready, not failed", async () => {
    serve({ code: ResponseCode.Ok, data: [], meta: { groups: ["low"] } });

    const { read, flush } = probe(useAlertFeed);
    await flush();

    const section = read();
    expect(section.status).toBe("ready");
    expect(section.rows).toEqual([]);
    // The vocabulary survives an empty answer, which is the case the chips need:
    // a service with nothing to report still has things it could report.
    expect(section.groups).toEqual(["low"]);
  });

  test("refuses a payload whose code is not Ok", async () => {
    serve({
      code: ResponseCode.Internal,
      data: consoleFixtures["alerts/feed"].data,
      meta: consoleFixtures["alerts/feed"].meta,
    });

    const { read, flush } = probe(useAlertFeed);
    await flush();

    const section = read();
    expect(section.status).toBe("failed");
    // The rows are not in the hook either. A payload carrying an error code still
    // has a body, and a panel that rendered it would be showing data the service
    // declined to give — which for an internal service is data the operator is
    // not cleared for.
    expect(section.rows).toEqual([]);
    expect(section.groups).toEqual([]);
  });

  /**
   * The URL the browser sends, and the thing most likely to regress silently.
   *
   * It has to be a *relative* path. An absolute one to central-api would be a
   * `NEXT_PUBLIC_` value inlined into the client bundle, which puts the service's
   * address in every visitor's devtools and makes the token attached on the way
   * out impossible. So the assertion is not "the right host" but "no host at
   * all": a path with a leading `/` and nothing in front of it, which the browser
   * resolves against the origin it was loaded from.
   */
  test("asks this app's own origin at the section's own path", async () => {
    serve(consoleFixtures["alerts/feed"]);

    const { flush } = probe(useAlertFeed);
    await flush();

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe("/api/v1/alerts/feed");
  });

  test("sends no token, and no other credential, to its own origin", async () => {
    serve(consoleFixtures["alerts/feed"]);

    const { flush } = probe(useAlertFeed);
    await flush();

    // A header here would be a token in a client bundle. The guard on the other
    // side is why one is not needed: this app's route handler presents the
    // service token from the server's environment, and the browser's request
    // carries nothing worth forwarding.
    const headers = new Headers(vi.mocked(fetch).mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-hewa-service-token")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
  });

  /**
   * Two sections of one view are two different reads.
   *
   * The cache is keyed by section and not by view, so a panel can never be handed
   * its sibling's rows. This is the assertion behind that key: two hooks, two
   * paths, two cache entries.
   */
  test("a section's cache key is the section, not the view it lives under", async () => {
    serve(consoleFixtures["infrastructure/nodes"]);
    const { cache, flush } = probe(useNodes);
    await flush();

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/v1/infrastructure/nodes");
    // The entry is under the section key. Keyed by view it would be
    // `["console", "infrastructure"]`, and `alerts/feed` would be handed
    // `infrastructure/nodes`' rows — one query cache serving two destinations,
    // with whichever answered last quietly answering for both.
    expect(cache.getQueryData(["console", "infrastructure/nodes"])).toBeDefined();
    expect(cache.getQueryData(["console", "infrastructure"])).toBeUndefined();
  });
});

describe("useMarketBook", () => {
  test("has no document at all before the service answers", () => {
    // The other sections can honestly say "nothing to show" while waiting,
    // because an empty list is what they would have been. This one cannot: its
    // data is one document, and an empty market drawn as a flat price line says
    // the price is flat rather than that nothing arrived.
    const { read } = probe(useMarketBook);

    expect(read().status).toBe("pending");
    expect(read().data).toBeUndefined();
  });

  test("has the document the service sent", async () => {
    serve(consoleFixtures["market/book"]);

    const { read, flush } = probe(useMarketBook);
    await flush();

    const section = read();
    expect(section.status).toBe("ready");
    expect(section.data?.bestBid).toEqual(consoleFixtures["market/book"].data.bestBid);
    expect(section.data?.orders).toEqual(consoleFixtures["market/book"].data.orders);
  });

  test("is failed, not ready, when the document did not arrive", async () => {
    // The distinction that matters most here. A zeroed market document is a
    // plausible lie: no bid, no offer, nothing committed, a flat line. A panel
    // drawing one because a request failed is reporting a market that stopped
    // trading, which is a different and much worse claim than "we could not ask".
    refuse(503);

    const { read, flush } = probe(useMarketBook);
    await flush();

    expect(read().status).toBe("failed");
    expect(read().data).toBeUndefined();
  });

  test("a book with nothing in it is a book with nothing in it", async () => {
    // The other half of the distinction, and the reason `bestBid` is nullable. An
    // empty book is a real state with real answers — no bid, no offer, zero
    // committed — and it is not the same answer as "we could not ask". Both are
    // drawn, and neither is confused with the other.
    serve({
      code: ResponseCode.Ok,
      data: {
        bestBid: null,
        bestOffer: null,
        committedGbps: 0,
        openOrders: 0,
        currency: "USD",
        orders: [],
      },
      meta: { groups: [] },
    });

    const { read, flush } = probe(useMarketBook);
    await flush();

    expect(read().status).toBe("ready");
    expect(read().data?.bestBid).toBeNull();
    expect(read().data?.orders).toEqual([]);
  });
});

describe("emptyMessage", () => {
  test("says it is loading rather than that there is nothing", () => {
    expect(
      emptyMessage({ status: "pending", filtered: false, noun: "alerts", filter: "these" }),
    ).toBe("Loading alerts…");
  });

  test("names the service when there was no answer", () => {
    expect(emptyMessage({ status: "failed", filtered: false, noun: "alerts" })).toBe(
      "Could not reach central-api for alerts",
    );
  });

  test("blames the filter only when one is in force", () => {
    expect(
      emptyMessage({
        status: "ready",
        filtered: true,
        noun: "alerts",
        filter: "these severities",
      }),
    ).toBe("No alerts match these severities");
    expect(emptyMessage({ status: "ready", filtered: false, noun: "alerts" })).toBe(
      "No alerts to show",
    );
  });

  test("a failure is never reported as a filter", () => {
    // The order matters and is the point: a filter in force alongside a service
    // that is down must still say the service is down, or the operator clears a
    // filter that was never the problem.
    expect(
      emptyMessage({
        status: "failed",
        filtered: true,
        noun: "alerts",
        filter: "these severities",
      }),
    ).toBe("Could not reach central-api for alerts");
  });
});

describe("the price series names the pool it belongs to", () => {
  /**
   * The chart draws one line per pool, so the document holds every pool's history
   * and the join has to be possible from the data alone. `SpotPoint.pool` rather
   * than one series per pool, because a payload that repeated the pool's name as
   * a series key would be a second copy of the vocabulary.
   */
  test("every observation names a pool the market knows about", () => {
    for (const point of consoleFixtures["market/prices"].data.points) {
      expect(Object.keys(MARKET_POOL_TITLES)).toContain(point.pool);
    }
  });

  test("every pool has a latest quote, so the table cannot miss one the chart draws", () => {
    // `latest` is derived from `points` by the same query, so a pool on the chart
    // and off the table would be a service bug rather than a panel's — and the
    // fixture is where that shows up first.
    const pools = new Set(consoleFixtures["market/prices"].data.points.map((point) => point.pool));
    for (const quote of consoleFixtures["market/prices"].data.latest) {
      expect(pools).toContain(quote.pool);
    }
  });
});
