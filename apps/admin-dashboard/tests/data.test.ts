import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  CONSOLE_SECTION_KEYS,
  CONSOLE_VIEWS,
  consoleSectionPath,
  parseSectionKey,
  type ConsolePayload,
  type ConsoleSectionKey,
} from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";
import { config } from "../src/app/shell.config";
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
 * service agree on what a section is, and that each module exports a hook per
 * section it owns.
 */

/** `data/` is one module per view, named after it, like `panels/`. */
const modules = readdirSync(new URL("../src/app/data/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

const keys = Object.keys(config.views).sort();

/** The sections each view owns, keyed by the module that owns them. */
const expectedSections: Record<string, readonly ConsoleSectionKey[]> = {
  market: ["market/book", "market/prices", "market/venues"],
  infrastructure: ["infrastructure/nodes", "infrastructure/headroom", "infrastructure/providers"],
  settlement: ["settlement/movements", "settlement/runs", "settlement/payouts"],
  slas: ["slas/commitments", "slas/at_risk", "slas/credits"],
  alerts: ["alerts/feed", "alerts/outages", "alerts/capacity", "alerts/security"],
};

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

describe("one hook per section", () => {
  /**
   * A panel fetches by section, so the hooks a module exports have to cover the
   * sections it owns and nothing else. The rule is written here rather than
   * generated from the rail, because the point is that the two are checked against
   * the *contract*: a module that grew a hook for a section the service does not
   * serve, or a section with no hook, is a question that cannot be asked or a
   * module that cannot answer one.
   */
  test("each view's module exports a hook for every section it owns", async () => {
    for (const [view, sections] of Object.entries(expectedSections)) {
      const loaded = (await import(`../src/app/data/${view}.ts`)) as Record<string, unknown>;
      const hooks = Object.entries(loaded)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name);

      expect(hooks.length, `${view} exports ${hooks.length} hooks`).toBe(sections.length);
    }
  });

  test("the sections a view owns are the ones the contract names", () => {
    // `CONSOLE_SECTIONS` is the service's list; this is what the app agrees to.
    expect(Object.keys(expectedSections).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
    for (const [view, sections] of Object.entries(expectedSections)) {
      expect(
        sections.map((section) => section.slice(view.length + 1)),
        view,
      ).toEqual(
        CONSOLE_SECTION_KEYS.filter((key) => key.startsWith(`${view}/`)).map((key) =>
          key.slice(view.length + 1),
        ),
      );
    }
  });

  test("a section with no group vocabulary has none in its fixture", async () => {
    // Four of the sixteen sections take no chips, and a chip bar built from a
    // vocabulary the service did not send is a control over nothing.
    const ungrouped: readonly ConsoleSectionKey[] = [
      "market/book",
      "market/prices",
      "market/venues",
      "infrastructure/providers",
      "settlement/runs",
    ];
    for (const section of ungrouped) {
      expect(consoleFixtures[section].meta.groups, section).toEqual([]);
    }
  });
});

describe("the response envelope", () => {
  test("a payload is a code, the data, and the group's vocabulary", () => {
    const feed: ConsolePayload["alerts/feed"] = {
      code: ResponseCode.Ok,
      data: [],
      meta: { groups: ["critical"] },
    };

    expect(Object.keys(feed).toSorted()).toEqual(["code", "data", "meta"]);
    expect(feed.code).toBe(ResponseCode.Ok);
  });

  /**
   * One path, two hops.
   *
   * The browser asks its own origin for `/api/v1/alerts/feed` and the route handler
   * asks central-api for the same path; only the base URL differs. So the function
   * that builds it is asserted here rather than trusted in two places, and the
   * prefix is `api/v1` because that is where the controller registers.
   */
  test("every section's path is under /api/v1 and named after itself", () => {
    for (const section of CONSOLE_SECTION_KEYS) {
      const { view, section: id } = parseSectionKey(section);
      expect(consoleSectionPath(view, id as never), section).toBe(`/api/v1/${section}`);
    }
  });

  test("a section key splits back into the view and section that built it", () => {
    // Round-tripped rather than spot-checked, because the split is what the query
    // hook and the route handler both do to work out where to fetch.
    for (const section of CONSOLE_SECTION_KEYS) {
      const { view, section: id } = parseSectionKey(section);
      expect(consoleSectionPath(view, id as never)).toBe(`/api/v1/${section}`);
    }
  });
});

describe("the fixtures", () => {
  test("there is one for every section, so a panel is never seeded from nothing", () => {
    expect(Object.keys(consoleFixtures).toSorted()).toEqual([...CONSOLE_SECTION_KEYS].toSorted());
  });

  test("a grouped section's vocabulary includes a group nothing is on", () => {
    // "a chip the bar offers that nothing is on" is a state the chips have to
    // survive, and a fixture in which every group is populated never puts it on
    // screen. `settlement/movements` is the one that has it: `escrow` is offered
    // and no row is on it.
    expect(consoleFixtures["settlement/movements"].meta.groups).toContain("escrow");
    for (const row of consoleFixtures["settlement/movements"].data) {
      expect(row.kind).not.toBe("escrow");
    }
  });

  /**
   * Which field each section's bar counts on, read from the panel rather than
   * guessed.
   *
   * Guessing is what this assertion did, and it was wrong in a way worth
   * keeping: it collected `status` from every row, and a node's `status` is
   * `operational` — a health figure on a column the bar does not filter. So the
   * test would have insisted a node's health were in the kind vocabulary, and
   * `operational` being absent read as a fixture defect rather than as the test
   * having picked the wrong column.
   *
   * Named per section, because "the field the bar counts on" is a decision each
   * panel makes and none of them shares: `settlement/payouts` counts a
   * transaction's `status`, `settlement/runs` has no field at all and derives a
   * pair, and `slas/at_risk` counts the `state` of a group rather than of a
   * monitor.
   */
  const GROUPED_BY = {
    "alerts/feed": "severity",
    "alerts/outages": "worstSeverity",
    "alerts/capacity": "severity",
    "alerts/security": "severity",
    "infrastructure/nodes": "kind",
    "infrastructure/headroom": "kind",
    "settlement/movements": "kind",
    "settlement/payouts": "status",
    "slas/commitments": "state",
    "slas/at_risk": "state",
    "slas/credits": "state",
  } as const satisfies Partial<Record<ConsoleSectionKey, string>>;

  test("every grouped section names the field its bar counts on", () => {
    // The complement of the test below: a section with rows and chips has to say
    // which of its row fields the chips are built from, or this file cannot check
    // it and the vocabulary goes unverified by accident.
    for (const section of CONSOLE_SECTION_KEYS) {
      const payload = consoleFixtures[section];
      if (!Array.isArray(payload.data) || payload.meta.groups.length === 0) {
        continue;
      }
      expect(GROUPED_BY, `${section} groups its rows but names no field`).toHaveProperty(section);
    }
  });

  test("every section's rows agree with the vocabulary sent beside them", () => {
    // A group the rows contradict is a chip that shows zero, which is fine; a row
    // whose value is not in the vocabulary is a row no chip can select.
    for (const section of CONSOLE_SECTION_KEYS) {
      const field = GROUPED_BY[section as keyof typeof GROUPED_BY];
      if (field === undefined) {
        continue;
      }
      const payload = consoleFixtures[section];
      const groups = payload.meta.groups as readonly string[];
      for (const row of payload.data as unknown as readonly Record<string, unknown>[]) {
        const value = row[field];
        if (typeof value !== "string") {
          continue;
        }
        expect(groups, `${section}/${field}: ${value}`).toContain(value);
      }
    }
  });
});
