import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  ALERT_SEVERITIES,
  CONSOLE_VIEWS,
  MARKET_POOL_TITLES,
  NODE_KINDS,
  SETTLEMENT_KINDS,
  consolePath,
  type ConsolePayload,
} from "@hewa/console-types";
import { SLA_STATES } from "@hewa/marketplace-types";
import { ResponseCode } from "@hewa/response-codes";
import { config } from "../src/app/shell.config";
import { MARKET_RAIL, poolFor } from "../src/app/panels/market";
import { consoleFixtures } from "./fixtures";

/**
 * The app's side of the API boundary.
 *
 * This file used to assert things about the records: that ids were unique, that
 * a flight's heading was under 360, that a sector's share added to a hundred.
 * All of that moved to the service with the records, because those are properties
 * of the data and the client does not get a say in them. Asserting them here
 * would have meant importing the records to check them, which is the arrangement
 * this change exists to end.
 *
 * What is left is what the app is actually responsible for: that `data/` is one
 * module per view, that those modules hold no records, that the app and the
 * service agree on what a view is, and that the rails still line up with the
 * vocabularies they select from.
 */

/** `data/` is one module per view, named after it, like `panels/`. */
const modules = readdirSync(new URL("../src/app/data/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

const keys = Object.keys(config.views).sort();

describe("data modules", () => {
  test("every view has exactly one module, named after its key", () => {
    expect(modules).toEqual(keys);
  });

  test("the app's views and the service's views are the same five", () => {
    // `CONSOLE_VIEWS` is the service's list of what it will answer for. If this
    // app gains a view the service has no route for, it fails here rather than as
    // a 404 behind a panel that renders its own empty state.
    expect(keys).toEqual([...CONSOLE_VIEWS].toSorted());
  });

  test("no module holds records", async () => {
    // Every runtime export of a `data/` module is a function. A record array
    // exported from one — `export const ALERTS = [...]` — is a value that is not
    // a function, and this is the assertion that says so.
    //
    // It is a deliberate check on the shape of the boundary rather than on its
    // behaviour, because the behaviour it guards has no symptom: a record put
    // back in this directory would still render, still be correct, and would
    // quietly become the app's source of truth again.
    for (const name of modules) {
      const loaded = (await import(`../src/app/data/${name}.ts`)) as Record<string, unknown>;

      for (const [exported, value] of Object.entries(loaded)) {
        expect(typeof value, `data/${name} exports ${exported}, which is not a hook`).toBe(
          "function",
        );
      }
    }
  });
});

describe("the response envelope", () => {
  test("a payload is a code, the data, and the group's vocabulary", () => {
    const alerts: ConsolePayload["alerts"] = {
      code: ResponseCode.Ok,
      data: [],
      meta: { groups: ["critical"] },
    };

    expect(Object.keys(alerts).toSorted()).toEqual(["code", "data", "meta"]);
    expect(alerts.code).toBe(ResponseCode.Ok);
  });

  /**
   * One path, two hops.
   *
   * The browser asks its own origin for `/api/v1/alerts` and the route handler
   * asks central-api for `/api/v1/alerts`; only the base URL differs. So the
   * function that builds it is asserted here rather than trusted in two places,
   * and the prefix is `api/v1` because that is where the controller registers.
   */
  test("every view's path is under /api/v1 and named after itself", () => {
    for (const view of CONSOLE_VIEWS) {
      expect(consolePath(view)).toBe(`/api/v1/${view}`);
    }
  });
});

describe("rails", () => {
  /**
   * A rail tab and a chip both select on a group value, so the two vocabularies
   * have to be the same list. A rail built from a hand-written copy of the kinds
   * is a tab that opens an empty column the day a kind is renamed, and it was:
   * the streams rail used to be written out in `shell.config.tsx` as well as in
   * the panel, and the two had come to name different channels.
   *
   * Asserted against the shared vocabulary rather than a panel's export, because
   * the vocabulary is what the service sends in `meta.groups` and what the chips
   * are built from. Two copies of it would each pass a test that only compared
   * them to each other.
   */
  const expectedRails: Record<string, readonly string[]> = {
    infrastructure: ["all", ...NODE_KINDS],
    settlement: ["all", ...SETTLEMENT_KINDS],
    slas: ["all", ...SLA_STATES],
    alerts: ["all", ...ALERT_SEVERITIES],
    market: Object.keys(MARKET_POOL_TITLES),
  };

  test("every rail tab is a group the service can hold, or the one that means all", () => {
    for (const [view, ids] of Object.entries(expectedRails)) {
      expect((config.views[view]?.rail ?? []).map((entry) => entry.id)).toEqual(ids);
    }
  });

  test("the only tab that is not a group is the one that means every group", () => {
    for (const view of ["infrastructure", "settlement", "slas", "alerts"]) {
      const rail = config.views[view]?.rail ?? [];
      expect(rail[0]?.id).toBe("all");
      // `all` is not a kind, a state, a severity or a settlement kind, which is
      // the whole reason it is spelled that way.
      expect(consoleFixtures[view as "infrastructure"].meta.groups).not.toContain("all");
    }
  });

  /**
   * A pool id and a `SpotPoint.pool` have to be the same string, because the rail
   * selection filters the series on it with no lookup between.
   */
  test("the market rail's ids are the pools the series carries", () => {
    expect(MARKET_RAIL.map((entry) => entry.id)).toEqual(Object.keys(MARKET_POOL_TITLES));
    for (const point of consoleFixtures.market.data.priceSeries) {
      expect(MARKET_RAIL.map((entry) => entry.id)).toContain(point.pool);
    }
  });

  /**
   * A selection travels in the query string and outlives the vocabulary it names.
   * An unknown pool resolves to the first one rather than to nothing, because a
   * panel rendering empty would report a rename as an outage.
   */
  test("a stale pool selection falls back to a pool rather than to nothing", () => {
    expect(poolFor("nairobi_ixp")).toBe("nairobi_ixp");
    expect(poolFor("a_pool_that_was_renamed")).toBe(MARKET_RAIL[0]?.id);
    expect(poolFor(null)).toBeNull();
  });
});
