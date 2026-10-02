import { Fragment, createElement, type ReactElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import { CONSOLE_SECTION_KEYS, type ConsoleSectionKey } from "@hewa/console-types";
import type { RailItem } from "@hewa/app-shell";

import { config } from "../src/app/shell.config";
import { consoleFixtures } from "./fixtures";
import { emptyQueryClient, renderConsole, seededQueryClient } from "./harness";

/**
 * Which sections narrow, how, and where the vocabulary is drawn.
 *
 * The narrowing moved out of a strip under each heading and into a column beside
 * the rail, and the reason it is worth a file of its own is that the split is a
 * judgement rather than a rendering: twelve sections publish a vocabulary, four
 * publish none and search their rows instead, and nothing in the config states
 * which is which. So the division has to be written down here, or a section that
 * quietly grew a second set of chips — or lost the column its filter lived in —
 * would pass every other test in this suite.
 *
 * Every section has the column. `RailItem.left` is required, so the type says it,
 * and what is left to assert is the *kind* of column: a section that drew a group
 * vocabulary where it has none would be filtering by groups the service never sent.
 *
 * The parts that press something live in `tests/filters.test.ts` and
 * `tests/search.test.ts`, which have the machinery for a click, a keystroke and a
 * query string. What is here is all readable from a server render: what each
 * section declares, what it drew, and where.
 */

/**
 * One section's columns, rendered the way the shell lays them out.
 *
 * The `data-column` marks are the assertion's only handle on which control is in
 * which column, so they are part of what is being tested rather than decoration:
 * a `data-group-item` that moved into the main column still works, and is now a
 * filter the heading explains and the table below it does not.
 */
const columnsOf = (key: ConsoleSectionKey): ReactElement => {
  const item = railItem(key);
  return createElement(
    Fragment,
    null,
    createElement("div", { "data-column": "left" }, createElement(item.left.render)),
    createElement("div", { "data-column": "main" }, createElement(item.main.render)),
  );
};

const render = (key: ConsoleSectionKey, client?: Parameters<typeof renderConsole>[1]): string =>
  renderConsole(columnsOf(key), client);

const railItem = (key: ConsoleSectionKey): RailItem => {
  for (const view of Object.values(config.views)) {
    const item = view.rail.find((entry) => entry.section === key);
    if (item !== undefined) {
      return item;
    }
  }
  throw new Error(`no rail item for ${key}`);
};

/** The groups a section's payload publishes, which is what its column is built from. */
const groups = (key: ConsoleSectionKey): readonly string[] =>
  consoleFixtures[key].meta.groups as readonly string[];

/** The twelve sections whose rows are grouped and therefore narrowable. */
const SCOPED = [
  "alerts/feed",
  "alerts/outages",
  "alerts/capacity",
  "alerts/security",
  "infrastructure/nodes",
  "infrastructure/headroom",
  "settlement/movements",
  "settlement/runs",
  "settlement/payouts",
  "slas/commitments",
  "slas/at_risk",
  "slas/credits",
] as const satisfies readonly ConsoleSectionKey[];

/**
 * The four that search rather than toggle, and they are four rather than three.
 *
 * `settlement/runs` has a vocabulary — a run is completed or it failed, and the
 * operator's first question about a run is which — but the service sends no
 * `meta.groups` for it, so the column derives its two groups from the rows
 * instead. It is in the twelve.
 *
 * The three market documents are a book, a price series and a venue breakdown,
 * and `infrastructure/providers` is already one row per provider: a group toggle
 * in any of them would select the row it was built from, or match nothing at all.
 * So they draw a search over the rows they list, which is a narrowing they can
 * honestly offer rather than one invented to fill the column.
 */
const SEARCHED = [
  "market/book",
  "market/prices",
  "market/venues",
  "infrastructure/providers",
] as const satisfies readonly ConsoleSectionKey[];

describe("every section has a column beside the rail", () => {
  test("there are sixteen of them, and this file classifies every one", () => {
    // The two lists below drive the loops, so a section in neither would go
    // unasserted rather than fail. This is what closes the gap.
    expect(SCOPED).toHaveLength(12);
    expect(SEARCHED).toHaveLength(4);
    expect([...SCOPED, ...SEARCHED].sort()).toEqual([...CONSOLE_SECTION_KEYS].sort());
  });

  for (const key of CONSOLE_SECTION_KEYS) {
    test(`the ${key} section declares one`, () => {
      // `RailItem.left` is required, so this is a compile-time fact already. It is
      // asserted because the fact that matters is not "some panel was written" but
      // "this destination declares one", and a config that spread a helper across
      // all sixteen would otherwise pass by accident.
      expect(railItem(key).left?.render, key).toBeTypeOf("function");
    });
  }

  test("the column declares the role it is for, because the toggle is named after it", () => {
    // The role is the only thing the title bar has to write "Toggle filters" rather
    // than "Toggle left panel", and it is the one way to catch a search panel
    // announced as a filter — which is a button that promises groups the section
    // does not have.
    for (const key of SCOPED) {
      expect(railItem(key).left.role, key).toBe("filter");
    }
    for (const key of SEARCHED) {
      expect(railItem(key).left.role, key).toBe("search");
    }
  });

  test("every column is titled, because that title is the column's only heading", () => {
    // The heading lives in the config rather than in the component, so a panel
    // whose title was dropped ships a column of toggles labelled only by the
    // toggles — which says what the axis is nowhere.
    for (const key of CONSOLE_SECTION_KEYS) {
      expect(railItem(key).left.title, key).toBeTruthy();
    }
  });
});

describe("where a section's vocabulary is drawn", () => {
  for (const key of SCOPED) {
    test(`the ${key} vocabulary is in the column and nowhere else`, () => {
      // The whole reason the column exists. Two controls for one filter is a
      // screen where the reader presses one and cannot tell what the other does,
      // and the main column is the one place a second copy would be invisible: it
      // sits directly above the table it is not filtering.
      const html = render(key);
      const left = columnOf(html, "left");
      expect(left, key).not.toBe("");
      expect(togglesIn(mainColumnOf(html)), key).toEqual([]);

      const drawn = groupsIn(key);
      expect(drawn.length, key).toBeGreaterThan(0);
      // One of each, over the whole tree rather than per column, so a column that
      // grew the neighbouring section's vocabulary fails here.
      expect(new Set(togglesIn(html)).size, key).toBe(drawn.length);
    });

    test(`the ${key} count line is in the column, not under the heading`, () => {
      // `3 of 12 alerts` is the number the operator checks the table against, and
      // it moves when the table does. Under the heading it would be a count of the
      // unfiltered list sitting above a filtered one.
      const html = render(key);
      const count = /<[^>]*data-scope-count[^>]*>([\s\S]*?)<\/p>/.exec(html);
      expect(count, key).not.toBeNull();
      expect(columnOf(html, "left"), key).toContain("data-scope-count");
      expect(mainColumnOf(html), key).not.toContain("data-scope-count");
    });
  }

  test("a section that publishes a vocabulary has one named group per group", () => {
    // The rule that vocabularies travel with their rows, checked as drawn rather
    // than as payload: a group the service sends that the column drops is a group
    // the operator cannot filter by, and a group the column invents is a filter
    // that hides everything.
    for (const key of SCOPED) {
      const drawn = groupsIn(key);
      const sent = groups(key);
      for (const group of sent) {
        expect(drawn, `${key} ${group}`).toContain(group);
      }
      if (sent.length > 0) {
        expect(drawn, key).toEqual([...sent]);
      }
    }
  });

  test("settlement/runs narrows by two groups it worked out for itself", () => {
    // The one column not built from `meta.groups`. A run's state is not sent as a
    // vocabulary, so the column derives `completed` and `failed` from the rows and
    // says so — and the derivation is the fragile part: a run that is `running`
    // and counted as neither is a run that vanished from the count the column
    // prints.
    const drawn = groupsIn("settlement/runs");
    expect(groups("settlement/runs")).toEqual([]);
    expect(drawn).toEqual(["completed", "failed"]);
    expect(render("settlement/runs")).toContain('data-group-item="completed"');
    expect(render("settlement/runs")).toContain('data-group-item="failed"');
  });
});

describe("a section that searches instead of toggling", () => {
  for (const key of SEARCHED) {
    test(`the ${key} section publishes no vocabulary`, () => {
      // `meta.groups: never` is the compile-time half of this; this is the payload
      // half, and it is what a column of toggles would have been built from.
      expect(groups(key), key).toEqual([]);
    });

    test(`the ${key} section draws a search and no group toggle anywhere`, () => {
      // The point of the column. Toggles here would match no row: the vocabulary
      // they would be built from is not in the payload, which is why these four are
      // the four that search.
      const html = render(key);
      expect(html, key).toContain("data-search-input");
      expect(html, key).toContain("data-search-count");
      expect(html, key).not.toContain("data-group-item");
      expect(html, key).not.toContain("data-scope-panel");
    });

    test(`the ${key} search is in the column and nowhere else`, () => {
      const html = render(key);
      expect(columnOf(html, "left"), key).toContain("data-search-input");
      expect(mainColumnOf(html), key).not.toContain("data-search-input");
    });

    test(`the ${key} count line is in the column, not under the heading`, () => {
      // `2 of 14 orders` is the number the reader checks the table against, and it
      // moves when the table does. Under the heading it would be a count of the
      // unsearched list sitting above a searched one.
      const html = render(key);
      expect(columnOf(html, "left"), key).toContain("data-search-count");
      expect(mainColumnOf(html), key).not.toContain("data-search-count");
    });
  }

  test("they still draw their figures", () => {
    // A column of one control must not cost the section its summary: the market's
    // figures and the provider table are the whole of what those screens say.
    for (const key of SEARCHED) {
      expect(render(key), key).toContain("data-summary-bar");
    }
  });

  test("a section that searches says so rather than offering an empty column", () => {
    // The reason these four were left empty in the first place: a column with
    // nothing in it reads as a column that failed to load, so the search is what
    // stops the rail from being sixteen screens of two different widths.
    for (const key of SEARCHED) {
      const html = render(key);
      expect(columnOf(html, "left"), key).not.toBe("");
      expect(html, key).toContain("of ");
    }
  });
});

describe("a section with nothing to narrow by", () => {
  /**
   * The state `ScopePanel` cannot reach from a fixture, and the reason it is
   * tested at all: a vocabulary is the groups the service published *or* the groups
   * the rows turned out to have, so it takes no rows and no published vocabulary to
   * get nothing. That is neither of the other two states — a section whose rows
   * have not arrived says so, and a section narrowed to nothing says what it is
   * narrowed by — so a reader is never left to guess which of the three arrived.
   *
   * `settlement/runs` is not asked: it names its two groups outright, so it draws
   * them at zero rather than drawing an empty column, which is the whole reason a
   * vocabulary is allowed to name groups no row currently holds.
   */
  for (const key of SCOPED.filter((section) => section !== "settlement/runs")) {
    test(`the ${key} column says it has nothing to narrow by`, () => {
      const client = seededQueryClient();
      const payload = consoleFixtures[key];
      client.setQueryData(["console", key], {
        ...payload,
        data: [],
        meta: { ...payload.meta, groups: [] },
      });

      const column = columnOf(render(key, client), "left");
      expect(column, key).toContain("nothing to narrow by");
      // Not "nothing matches": the reader pressed nothing, and a column that says
      // it has nothing to match is blaming a filter for a missing answer. Not a
      // count either — "0 of 0 alerts" is a claim about the world.
      expect(column, key).not.toContain("data-group-item");
      expect(column, key).not.toContain("of ");
    });
  }

  test("a section with rows still draws the groups those rows turned out to have", () => {
    // The other side of the same rule, and the reason the empty state above needs a
    // service that sends nothing: a column with rows and no published vocabulary
    // is a section with a vocabulary derived from its own rows.
    const client = seededQueryClient();
    const payload = consoleFixtures["alerts/feed"];
    client.setQueryData(["console", "alerts/feed"], {
      ...payload,
      meta: { ...payload.meta, groups: [] },
    });

    expect(columnOf(render("alerts/feed", client), "left")).toContain("data-group-item");
  });
});

describe("a column whose rows have not arrived", () => {
  for (const key of SCOPED) {
    test(`the ${key} column says it is loading`, () => {
      // Not "0 of 0": a figure over a service that has not answered is a claim
      // about the world, and it would be the first thing the operator saw. Not the
      // toggles either — a group pressed to find out why is a group with nothing
      // in it.
      const pending = render(key, emptyQueryClient());
      expect(pending, key).not.toContain("data-group-item");
      expect(pending, key).toContain("Loading ");
    });
  }
});

/* ------------------------------------------------------------------ helpers */

/**
 * The markup of one column, from the `data-column` mark to the end of its div.
 *
 * By depth rather than by a regex for a closing tag: the panels render nested
 * `<div>`s, so "up to the next `data-column`" is the only cut that does not
 * depend on how the markup happens to nest today.
 */
function columnOf(html: string, side: "left" | "main"): string {
  const start = html.indexOf(`data-column="${side}"`);
  if (start === -1) {
    return "";
  }
  const open = html.lastIndexOf("<div", start);
  let depth = 0;
  for (let index = open; index < html.length; index += 1) {
    if (html.startsWith("<div", index)) {
      depth += 1;
    } else if (html.startsWith("</div>", index)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(open, index + 6);
      }
    }
  }
  return html.slice(open);
}

const mainColumnOf = (html: string): string => columnOf(html, "main");

/** Every group a column draws a toggle for, in the order it draws them. */
function groupsIn(key: ConsoleSectionKey): string[] {
  const column = columnOf(render(key), "left");
  return [...column.matchAll(/data-group-item="([^"]+)"/g)].map((match) => match[1] ?? "");
}

const togglesIn = (html: string): string[] =>
  [...html.matchAll(/data-group-item="([^"]+)"/g)].map((match) => match[1] ?? "");
