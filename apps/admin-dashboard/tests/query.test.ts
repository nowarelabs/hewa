// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { QueryClientProvider } from "@tanstack/react-query";
import { ResponseCode } from "@hewa/response-codes";
import { MARKET_POOL_TITLES, type MarketPool } from "@hewa/console-types";

import { useAlerts, type AlertView } from "../src/app/data/alerts";
import { useMarket, type MarketView } from "../src/app/data/market";
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

type AnyView = AlertView | MarketView;

/** Renders a view's hook and hands back whatever it last returned. */
function probe<T extends AnyView>(useView: () => T): { read: () => T; flush: () => Promise<void> } {
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
          latest = useView();
          return createElement("div");
        }),
      ),
    );
  });

  return {
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

describe("useConsoleView", () => {
  test("reports pending and no rows before the service answers", () => {
    const { read } = probe(useAlerts);
    const view = read();

    expect(view.status).toBe("pending");
    expect(view.rows).toEqual([]);
    expect(view.groups).toEqual([]);
  });

  test("reports ready with the rows and the vocabulary the service sent", async () => {
    const payload = consoleFixtures["alerts"];
    serve(payload);

    const { read, flush } = probe(useAlerts);
    await flush();

    const view = read();
    expect(view.status).toBe("ready");
    expect(view.rows).toEqual(payload.data);
    expect(view.groups).toEqual(payload.meta.groups);
  });

  test("reports failed when the service answers with an error status", async () => {
    refuse(503);

    const { read, flush } = probe(useAlerts);
    await flush();

    const view = read();
    expect(view.status).toBe("failed");
    expect(view.rows).toEqual([]);
  });

  test("an answer of an empty list is ready, not failed", async () => {
    serve({ code: ResponseCode.Ok, data: [], meta: { groups: ["low"] } });

    const { read, flush } = probe(useAlerts);
    await flush();

    const view = read();
    expect(view.status).toBe("ready");
    expect(view.rows).toEqual([]);
    // The vocabulary survives an empty answer, which is the case the chips need:
    // a service with nothing to report still has things it could report.
    expect(view.groups).toEqual(["low"]);
  });

  test("refuses a payload whose code is not Ok", async () => {
    serve({
      code: ResponseCode.Internal,
      data: consoleFixtures["alerts"].data,
      meta: consoleFixtures["alerts"].meta,
    });

    const { read, flush } = probe(useAlerts);
    await flush();

    const view = read();
    expect(view.status).toBe("failed");
    // The rows are not in the hook either. A payload carrying an error code still
    // has a body, and a panel that rendered it would be showing data the service
    // declined to give — which for an internal service is data the operator is
    // not cleared for.
    expect(view.rows).toEqual([]);
    expect(view.groups).toEqual([]);
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
  test("asks this app's own origin at the view's own path", async () => {
    serve(consoleFixtures["alerts"]);

    const { flush } = probe(useAlerts);
    await flush();

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe("/api/v1/alerts");
  });

  test("sends no token, and no other credential, to its own origin", async () => {
    serve(consoleFixtures["alerts"]);

    const { flush } = probe(useAlerts);
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
});

describe("useMarket", () => {
  test("has no document at all before the service answers", () => {
    // The other four views can honestly say "nothing to show" while waiting,
    // because an empty list is what they would have been. This one cannot: its
    // data is one document, and an empty market drawn as a flat price line says
    // the price is flat rather than that nothing arrived.
    const { read } = probe(useMarket);

    expect(read().status).toBe("pending");
    expect(read().data).toBeUndefined();
  });

  test("has the document the service sent", async () => {
    serve(consoleFixtures["market"]);

    const { read, flush } = probe(useMarket);
    await flush();

    const view = read();
    expect(view.status).toBe("ready");
    expect(view.data?.bestBid).toEqual(consoleFixtures["market"].data.bestBid);
    expect(view.data?.sections).toEqual(consoleFixtures["market"].data.sections);
    expect(view.data?.priceSeries).toEqual(consoleFixtures["market"].data.priceSeries);
  });

  test("is failed, not ready, when the document did not arrive", async () => {
    // The distinction that matters most here. A zeroed market document is a
    // plausible lie: no bid, no offer, nothing committed, a flat line. A panel
    // drawing one because a request failed is reporting a market that stopped
    // trading, which is a different and much worse claim than "we could not ask".
    refuse(503);

    const { read, flush } = probe(useMarket);
    await flush();

    expect(read().status).toBe("failed");
    expect(read().data).toBeUndefined();
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

describe("the market rail and the sections it selects", () => {
  /**
   * The rail picks a pool and the document holds one section per pool, so the
   * join is the only thing between a tab and the figures it opens.
   *
   * Written against the fixture rather than a panel: the panel\'s job is to render
   * whatever this returns, and the rule worth checking is that every id the rail
   * can produce resolves to a section that names itself.
   */
  test("every rail id has a section whose id is the same value", () => {
    const ids = consoleFixtures["market"].data.sections.map((section) => section.id);

    for (const pool of Object.keys(MARKET_POOL_TITLES)) {
      expect(ids).toContain(pool);
    }
  });

  test("a section titles itself rather than borrowing the rail's label", () => {
    // The two are allowed to differ — a rail tab says "Subsea" because that is
    // what fits in an icon rail — so the payload carries the pool\'s own name and
    // the panel renders that.
    for (const section of consoleFixtures["market"].data.sections) {
      // `satisfies` keeps the fixture's own literal types but does not widen them
      // into the payload contract, so the id is `string` here and the lookup needs
      // the pool it claims to be.
      const pool = section.id as MarketPool;
      expect(Object.keys(MARKET_POOL_TITLES)).toContain(pool);
      expect(section.title).toBe(MARKET_POOL_TITLES[pool]);
    }
  });

  test("the series names the pool it belongs to", () => {
    // `SpotPoint.pool` rather than one series per pool: the document holds every
    // pool\'s history and the chart draws a line per pool, so the rail selection
    // has to be able to join against it.
    for (const point of consoleFixtures["market"].data.priceSeries) {
      expect(Object.keys(MARKET_POOL_TITLES)).toContain(point.pool);
    }
  });
});
