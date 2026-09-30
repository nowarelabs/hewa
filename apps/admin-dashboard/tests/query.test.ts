// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { QueryClientProvider } from "@tanstack/react-query";
import { ResponseCode } from "@hewa/response-codes";

import { useAlerts, type AlertView } from "../src/app/data/alerts";
import { figuresFor, useEconomy, type EconomyView } from "../src/app/data/economic";
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

type AnyView = AlertView | EconomyView;

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

describe("useEconomy", () => {
  test("has no figures at all before the service answers", () => {
    // The other six views can honestly say "nothing to show" while waiting,
    // because an empty list is what they would have been. This one cannot: its
    // data is four shapes, and an empty economy drawn as two flat charts says
    // the economy is flat rather than that nothing arrived.
    const { read } = probe(useEconomy);

    expect(read().status).toBe("pending");
    expect(read().data).toBeUndefined();
  });

  test("has the figures the service sent", async () => {
    serve(consoleFixtures["economic"]);

    const { read, flush } = probe(useEconomy);
    await flush();

    const view = read();
    expect(view.status).toBe("ready");
    expect(view.data?.indicators).toEqual(consoleFixtures["economic"].data.indicators);
    expect(view.data?.sections).toEqual(consoleFixtures["economic"].data.sections);
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

describe("figuresFor", () => {
  test("finds a rail section by id", () => {
    expect(figuresFor(consoleFixtures["economic"].data.sections, "overview")).toEqual([
      { label: "GDP growth", value: "5.1%" },
    ]);
  });

  test("has no figures for a section the service did not send", () => {
    expect(figuresFor(consoleFixtures["economic"].data.sections, "trade")).toEqual([]);
    expect(figuresFor([], "overview")).toEqual([]);
  });
});
