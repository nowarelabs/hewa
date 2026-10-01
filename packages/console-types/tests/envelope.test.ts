import { describe, expect, test } from "vite-plus/test";
import {
  ALERT_CATEGORIES,
  ALERT_SEVERITIES,
  ALERT_SEVERITY_TITLES,
  CONSOLE_VIEWS,
  consolePath,
  NODE_KINDS,
  NODE_KIND_TITLES,
  NODE_STATUSES,
  SETTLEMENT_KINDS,
  SETTLEMENT_KIND_TITLES,
  type ConsoleGroups,
  type ConsolePayload,
  type ConsoleViewKey,
} from "../src/index.ts";

/**
 * The contract's own internal consistency.
 *
 * A types-only package has very little to assert at runtime, so this is mostly
 * about the two places a hand-written list can lie: the views named in
 * `CONSOLE_VIEWS` and the views typed in `ConsolePayload`. They are written out
 * separately — one has to be, because a type is erased — and the app's
 * `tests/data.test.ts` and the service's e2e test each hold one end of the pair.
 * This holds them together at build time, so the disagreement is a failed type
 * check rather than a 404.
 */

const typed: Record<ConsoleViewKey, keyof ConsolePayload> = {
  market: "market",
  infrastructure: "infrastructure",
  settlement: "settlement",
  slas: "slas",
  alerts: "alerts",
};

/**
 * The other direction.
 *
 * Without this, a key added to `ConsolePayload` and forgotten in `CONSOLE_VIEWS`
 * is a payload no view can name and nothing complains: `typed` satisfies its
 * annotation with the extra key simply absent, because a `Record` annotation
 * checks the keys that are there.
 */
const viewed: Record<keyof ConsolePayload, ConsoleViewKey> = typed;

describe("the console's views", () => {
  test("the payload map and the view list name the same five", () => {
    expect(Object.keys(typed).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
    expect(Object.keys(viewed).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
  });

  test("a view is listed once", () => {
    expect(new Set(CONSOLE_VIEWS).size).toBe(CONSOLE_VIEWS.length);
  });
});

describe("consolePath", () => {
  test("a view's endpoint hangs off the versioned prefix", () => {
    // `api/v1` rather than `console`, and the reason is the two hops. The browser
    // asks its own origin for this path and the app's route handler asks
    // central-api for the same one, so the prefix is the app's public API and not a
    // name for one service behind it. Renaming the prefix moves both sides because
    // both read it here.
    expect(consolePath("market")).toBe("/api/v1/market");
    expect(consolePath("alerts")).toBe("/api/v1/alerts");
  });

  test("every view has a path, and no two share one", () => {
    const paths = CONSOLE_VIEWS.map(consolePath);
    expect(new Set(paths).size).toBe(CONSOLE_VIEWS.length);
  });
});

describe("the view that groups by nothing", () => {
  /**
   * `market` counts figures and draws a book rather than filtering a list, so it
   * has no group vocabulary. `never` is the honest annotation for that: a chip
   * built from its groups does not compile, where `string[]` would compile into an
   * empty bar that reads as "still loading" on a view that has nothing to load.
   */
  test("its group list holds no group at all", () => {
    const groups: ConsoleGroups<"market"> = [];
    expect([...groups]).toEqual([]);
  });

  test("every other view names a group type, so none of them is accidentally ungrouped", () => {
    // The inverse of the assertion above, and the reason it is worth writing: a
    // list view whose groups became `never` would stop offering filters and
    // nothing would say so except an operator discovering it.
    const groups: ConsoleGroups<"infrastructure"> = ["ixp"];
    const more: ConsoleGroups<"settlement"> = ["clearing"];
    const states: ConsoleGroups<"slas"> = ["breached"];
    const severities: ConsoleGroups<"alerts"> = ["critical"];

    expect([...groups, ...more, ...states, ...severities]).toHaveLength(4);
  });
});

describe("the group vocabularies a filter bar is built from", () => {
  /**
   * Each of these is a list the console turns into chips and a rail tabs, and
   * each is a *value* the rows carry. The assertions below are the ones that hold
   * when someone adds a member to the list and forgets everything else: a title
   * map is a `Record`, so a missing entry renders `undefined` instead of failing
   * to compile, and a list that drifts from the union means a row can hold a
   * group no chip offers.
   */
  // Widened rather than `as const` on the entries: each case carries a different
  // union as its keys, so a narrower annotation makes `titles[value]` a union of
  // three record types that no single `value` indexes. The per-case assertions run
  // on runtime values, so nothing is lost by declaring the shape as strings — and
  // what the widening costs is the compile-time half of the "keyed by the value"
  // claim, which is exactly the half the `Record` key already covers.
  const cases: {
    name: string;
    values: readonly string[];
    titles: Record<string, string> | null;
  }[] = [
    { name: "node kinds", values: NODE_KINDS, titles: NODE_KIND_TITLES },
    { name: "node statuses", values: NODE_STATUSES, titles: null },
    { name: "settlement kinds", values: SETTLEMENT_KINDS, titles: SETTLEMENT_KIND_TITLES },
    { name: "alert severities", values: ALERT_SEVERITIES, titles: ALERT_SEVERITY_TITLES },
    { name: "alert categories", values: ALERT_CATEGORIES, titles: null },
  ];

  for (const { name, values, titles } of cases) {
    test(`${name} holds no duplicate`, () => {
      expect(new Set(values).size, name).toBe(values.length);
    });

    if (titles !== null) {
      test(`${name} has a title for every value`, () => {
        // Keyed by the value a consumer passes, not by the member name: the
        // fixture rows and the query string both carry `at_risk`, so a map keyed
        // `AT_RISK` would type-check against the union and miss every row.
        expect(Object.keys(titles).sort(), name).toEqual([...values].sort());
        for (const value of values) {
          expect(titles[value], `${name}: ${value}`).toBeTypeOf("string");
          expect(titles[value], `${name}: ${value}`).not.toBe("");
        }
      });

      test(`${name} titles are written for a reader`, () => {
        // A title that still holds the wire format is the raw column value
        // leaking into the UI, so the underscore check is the assertion.
        for (const value of values) {
          expect(titles[value], `${name}: ${value}`).not.toContain("_");
        }
      });
    }
  }
});
