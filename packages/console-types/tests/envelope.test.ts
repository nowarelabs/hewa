import { describe, expect, test } from "vite-plus/test";
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_TITLES,
  ALERT_SEVERITIES,
  ALERT_SEVERITY_TITLES,
  CONSOLE_SECTION_KEYS,
  CONSOLE_SECTIONS,
  CONSOLE_VIEWS,
  consoleSectionPath,
  NODE_KINDS,
  NODE_KIND_TITLES,
  NODE_STATUSES,
  parseSectionKey,
  SECTION_TITLES,
  SETTLEMENT_KINDS,
  SETTLEMENT_KIND_TITLES,
  type ConsoleGroups,
  type ConsolePayload,
  type ConsoleSectionId,
  type ConsoleSectionKey,
  type ConsoleViewKey,
} from "../src/index.ts";

/**
 * The contract's own internal consistency.
 *
 * A types-only package has very little to assert at runtime, so this is mostly
 * about the two places a hand-written list can lie: the sections named in
 * `CONSOLE_SECTIONS` and the sections typed in `ConsolePayload`. They are written
 * out separately — one has to be, because a type is erased — and the app's
 * `tests/data.test.ts` and the service's e2e test each hold one end of the pair.
 * This holds them together at build time, so the disagreement is a failed type
 * check rather than a 404.
 */

const typed: Record<ConsoleSectionKey, keyof ConsolePayload> = {
  "market/book": "market/book",
  "market/prices": "market/prices",
  "market/venues": "market/venues",
  "infrastructure/nodes": "infrastructure/nodes",
  "infrastructure/headroom": "infrastructure/headroom",
  "infrastructure/providers": "infrastructure/providers",
  "settlement/movements": "settlement/movements",
  "settlement/runs": "settlement/runs",
  "settlement/payouts": "settlement/payouts",
  "slas/commitments": "slas/commitments",
  "slas/at_risk": "slas/at_risk",
  "slas/credits": "slas/credits",
  "alerts/feed": "alerts/feed",
  "alerts/outages": "alerts/outages",
  "alerts/capacity": "alerts/capacity",
  "alerts/security": "alerts/security",
};

/**
 * The other direction.
 *
 * Without this, a key added to `ConsolePayload` and forgotten in
 * `CONSOLE_SECTIONS` is a payload no section key can name and nothing complains:
 * `typed` satisfies its annotation with the extra key simply absent, because a
 * `Record` annotation checks the keys that are there.
 */
const viewed: Record<keyof ConsolePayload, ConsoleSectionKey> = typed;

describe("the console's sections", () => {
  test("the payload map and the section registry name the same sixteen", () => {
    expect(Object.keys(typed).toSorted()).toEqual([...CONSOLE_SECTION_KEYS].toSorted());
    expect(Object.keys(viewed).toSorted()).toEqual([...CONSOLE_SECTION_KEYS].toSorted());
  });

  test("every view owns at least one section", () => {
    // A rail column with nothing in it is a navigation dead end, and nothing in
    // the shell treats one differently from a populated one — it just renders.
    for (const view of CONSOLE_VIEWS) {
      expect(CONSOLE_SECTIONS[view].length, view).toBeGreaterThan(0);
    }
    expect(Object.keys(CONSOLE_SECTIONS).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
  });

  test("a section key is named once", () => {
    expect(new Set(CONSOLE_SECTION_KEYS).size).toBe(CONSOLE_SECTION_KEYS.length);
  });

  test("the flattened key list is the registry, in registry order", () => {
    // `CONSOLE_SECTION_KEYS` is derived rather than hand-listed, so the assertion
    // that matters is that the derivation is total: every section in every view
    // appears, and none appears under a view it does not belong to.
    const expected = CONSOLE_VIEWS.flatMap((view) =>
      CONSOLE_SECTIONS[view].map((section) => `${view}/${section}`),
    );
    expect(CONSOLE_SECTION_KEYS).toEqual(expected);
  });

  test("a key parses back into the view and section it was built from", () => {
    for (const key of CONSOLE_SECTION_KEYS) {
      const { view, section } = parseSectionKey(key);
      expect(section, key).toBe(key.slice(view.length + 1));
      expect(CONSOLE_VIEWS as readonly string[], key).toContain(view);
      expect(CONSOLE_SECTIONS[view as ConsoleViewKey] as readonly string[], key).toContain(section);
    }
  });
});

describe("consoleSectionPath", () => {
  test("a section's endpoint hangs off the versioned prefix and names both halves", () => {
    // `api/v1` rather than `console`, and the reason is the two hops. The browser
    // asks its own origin for this path and the app's route handler asks
    // central-api for the same one, so the prefix is the app's public API and not a
    // name for one service behind it. Renaming the prefix moves both sides because
    // both read it here.
    expect(consoleSectionPath("market", "book")).toBe("/api/v1/market/book");
    expect(consoleSectionPath("alerts", "security")).toBe("/api/v1/alerts/security");
  });

  test("every section has a path, and no two share one", () => {
    // Two sections sharing a path would mean one section's rows answering for
    // another, which is the failure the whole split exists to prevent.
    const paths = CONSOLE_SECTION_KEYS.map((key) => {
      const { view, section } = parseSectionKey(key);
      return consoleSectionPath(
        view as ConsoleViewKey,
        section as ConsoleSectionId<ConsoleViewKey>,
      );
    });
    expect(new Set(paths).size).toBe(CONSOLE_SECTION_KEYS.length);
    expect(paths).toEqual(CONSOLE_SECTION_KEYS.map((key) => `/api/v1/${key}`));
  });
});

describe("section titles", () => {
  test("every section has a title, and no two share one", () => {
    expect(Object.keys(SECTION_TITLES).toSorted()).toEqual([...CONSOLE_SECTION_KEYS].toSorted());
    const titles = Object.values(SECTION_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("a title is written for a reader", () => {
    // The wire id is `at_risk` and the title is "At risk". A title that still
    // holds the wire format is the raw column value leaking into the rail, so the
    // underscore check is the assertion.
    for (const [key, title] of Object.entries(SECTION_TITLES)) {
      expect(title, key).toBeTypeOf("string");
      expect(title, key).not.toBe("");
      expect(title, key).not.toContain("_");
      expect(title, key).not.toContain("/");
    }
  });

  test("a title does not restate the view it sits under", () => {
    // The view already has a tab above it with the rail's own heading, so a
    // section called "Alerts" inside the alerts view prints its own name twice.
    // `alert`/`alerts` is the only one that would, which is why this is a case
    // rather than a loop.
    expect(SECTION_TITLES["alerts/feed"]).not.toMatch(/^alerts?$/i);
  });
});

describe("sections that group by nothing", () => {
  /**
   * The three market sections, the provider rollup and the settlement runs
   * answer a question rather than showing a filtered list, so they have no group
   * vocabulary. `never` is the honest annotation for that: a chip built from
   * their groups does not compile, where `string[]` would compile into an empty
   * bar that reads as "still loading" on a view that has nothing to load.
   */
  const ungrouped = [
    "market/book",
    "market/prices",
    "market/venues",
    "infrastructure/providers",
    "settlement/runs",
  ] as const;

  test("their group list holds no group at all", () => {
    const book: ConsoleGroups<"market/book"> = [];
    const venues: ConsoleGroups<"market/venues"> = [];
    const providers: ConsoleGroups<"infrastructure/providers"> = [];
    const runs: ConsoleGroups<"settlement/runs"> = [];
    expect([...book, ...venues, ...providers, ...runs]).toEqual([]);
  });

  test("every other section names a group type, so none is accidentally ungrouped", () => {
    // The inverse of the assertion above, and the reason it is worth writing: a
    // list section whose groups became `never` would stop offering filters and
    // nothing would say so except an operator discovering it.
    const nodes: ConsoleGroups<"infrastructure/nodes"> = ["ixp"];
    const headroom: ConsoleGroups<"infrastructure/headroom"> = ["subsea_cable"];
    const movements: ConsoleGroups<"settlement/movements"> = ["clearing"];
    const payouts: ConsoleGroups<"settlement/payouts"> = ["completed"];
    const states: ConsoleGroups<"slas/at_risk"> = ["breached"];
    const severities: ConsoleGroups<"alerts/feed"> = ["critical"];

    expect([
      ...nodes,
      ...headroom,
      ...movements,
      ...payouts,
      ...states,
      ...severities,
    ]).toHaveLength(6);
  });

  test("the ungrouped list names only sections that really are ungrouped", () => {
    // If a section is added to `ungrouped` by accident the assertion above stops
    // compiling in a way that is easy to read as "the test is broken". This names
    // the count instead, so the list cannot quietly grow.
    expect(ungrouped).toHaveLength(5);
  });
});

describe("the group vocabularies a filter bar is built from", () => {
  /**
   * Each of these is a list the console turns into chips, and each is a *value*
   * the rows carry. The assertions below are the ones that hold when someone adds
   * a member to the list and forgets everything else: a title map is a `Record`,
   * so a missing entry renders `undefined` instead of failing to compile, and a
   * list that drifts from the union means a row can hold a group no chip offers.
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
    { name: "alert categories", values: ALERT_CATEGORIES, titles: ALERT_CATEGORY_TITLES },
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
