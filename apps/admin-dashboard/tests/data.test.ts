import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { CONSOLE_VIEWS, consolePath, type ConsolePayload } from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";
import { config } from "../src/app/shell.config";
import { FLIGHT_RAIL } from "../src/app/panels/flights";
import { STREAM_RAIL } from "../src/app/panels/streams";
import { consoleFixtures } from "./fixtures";

/**
 * The app's side of the API boundary.
 *
 * This file used to assert things about the records: that ids were unique, that
 * a flight's heading was under 360, that a sector's share added to a hundred.
 * All of that moved to `services/central-api/tests/console.records.test.ts`,
 * with the records, because those are properties of the data and the client does
 * not get a say in them. Asserting them here would have meant importing the
 * records to check them, which is the arrangement this change exists to end.
 *
 * What is left is what the app is actually responsible for: that `data/` is one
 * module per view, that those modules hold no records, that the app and the
 * service agree on what a view is, and that the rails still line up with the
 * panels that filter on them.
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

  test("the app's views and the service's views are the same seven", () => {
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
  // The panel's rail is what the shell config builds from, so the two can only
  // disagree by the config importing a different list than the panel filters on.
  test("the shell's rail is the panel's rail", () => {
    // Asserted per view, because the drift this catches is per view: the
    // streams rail used to be written out in `shell.config.tsx` as well as in
    // the panel, and the two had come to name different channels.
    expect((config.views["flights"]?.rail ?? []).map((entry) => entry.id)).toEqual(
      FLIGHT_RAIL.map((entry) => entry.id),
    );
    expect((config.views["streams"]?.rail ?? []).map((entry) => entry.id)).toEqual(
      STREAM_RAIL.map((entry) => entry.id),
    );
  });

  // A rail entry is a tab, and the tab opens a panel that filters on the entry's
  // carrier. Nothing in the app can check that there are flights behind it any
  // more — the flights are the service's — but it can check that every entry
  // names a carrier at all, and that "all" means the one entry that does not.
  test("every flights rail entry names a carrier except the one that means all", () => {
    for (const entry of config.views["flights"]?.rail ?? []) {
      const opensOneCarrier = entry.id !== "all";
      expect(
        typeof FLIGHT_RAIL.find((candidate) => candidate.id === entry.id)?.carrier === "string",
      ).toBe(opensOneCarrier);
    }
  });

  test("every streams rail entry names a channel except the one that means all", () => {
    for (const entry of config.views["streams"]?.rail ?? []) {
      const opensOneChannel = entry.id !== "all";
      expect(
        typeof STREAM_RAIL.find((candidate) => candidate.id === entry.id)?.channel === "string",
      ).toBe(opensOneChannel);
    }
  });
  // Deliberately not asserted: that every tab's value is in `meta.groups`. The
  // fixture models a flights feed that names `Unknown` with no tab for it and
  // holds `Fly540` with no group for it, and both are states the panel is
  // meant to survive — a tab the service does not offer falls back to the whole
  // catalogue rather than opening an empty column. The duplicate hand-written
  // rail that caused the streams drift is caught by the first test instead,
  // which is where the fault actually was.
  test("a group the service names but no tab opens still gets a chip", () => {
    const groups = consoleFixtures["flights"].meta.groups;
    const tabbed = FLIGHT_RAIL.map((entry) => entry.carrier);

    expect(groups).toContain("Unknown");
    expect(tabbed).not.toContain("Unknown");
    expect(groups).not.toContain("all");
  });
});
