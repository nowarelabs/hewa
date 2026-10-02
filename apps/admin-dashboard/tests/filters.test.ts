// @vitest-environment happy-dom

import { act, createElement, Fragment, type ReactElement } from "react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import type { QueryClient } from "@tanstack/react-query";
import type { ConsoleSectionKey } from "@hewa/console-types";
import type { RailItem } from "@hewa/app-shell";

import { config } from "../src/app/shell.config";
import { visibleBy } from "../src/app/ui/primitives";
import { consoleFixtures } from "./fixtures";
import { emptyQueryClient, mountInteractive, unmountAll, urlOf } from "./harness";

/**
 * Every panel here reads its rows from a service, so every mount is given a
 * `QueryClient` with the fixtures already in it. Without one the tree renders
 * "Loading nodes…" and every count below would be a count of nothing.
 *
 * The rows come from `tests/fixtures.ts` rather than from the service's records,
 * so a change to the data is not a change to this suite's expectations. The
 * counts further down are therefore counts of the fixtures, and they are small
 * on purpose.
 */

/**
 * The left column and the list it narrows, and the filter in the address bar.
 *
 * The narrowing used to be a strip under the heading, whose chips counted the rows
 * beneath it. That is the shape of a control that is nearly a control: the only
 * reason to read "High: 1" is to go and look at the one high alert, and the count
 * was answering a question it could have asked itself. It is also the shape where
 * the count and the list can disagree — the strip kept saying how many there were
 * while the table below it showed how many were in force.
 *
 * So both columns are mounted here, each marked with `data-column`, and every test
 * is the same claim in a different view: a narrowing control that works in the
 * alerts view and not in the SLAs one is two implementations wearing one name.
 *
 * The second claim is the harder one. The filter state is in the query string,
 * not in a component, so half of what is worth checking cannot be seen in the
 * tree at all: whether a press wrote the key, whether a second press took it
 * away, and whether the URL a colleague opens says what the operator saw.
 */

afterEach(() => {
  unmountAll();
});

/**
 * `mountInteractive`, in the shape this file has always used it in.
 *
 * Two names rather than one because these tests read a container and a query
 * string separately all the way down, and threading an object through thirty
 * assertions to keep the destructuring tidy would be the only change in it.
 */
const mount = (element: ReactElement, searchParams = "", client?: QueryClient): HTMLElement =>
  mountInteractive(element, searchParams, client).container;

const url = urlOf;

/**
 * One section's two columns, taken from the rail item that opens it.
 *
 * Through the config rather than by importing the panels directly, so these tests
 * exercise the same wiring the shell renders: a section whose rail item points at
 * the wrong panel, or at a left column belonging to a neighbouring section, fails
 * here rather than counting the rows of a neighbour.
 *
 * The left column comes first and both are marked, because the point of the split
 * is which control is in which one — a test that mounted them in an order it did
 * not check would pass on a column drawn twice.
 */
const railItem = (key: ConsoleSectionKey): RailItem => {
  for (const spec of Object.values(config.views)) {
    const item = spec.rail.find((entry) => entry.section === key);
    if (item !== undefined) {
      return item;
    }
  }
  throw new Error(`no rail item for ${key}`);
};

const columns = (key: ConsoleSectionKey): ReactElement => {
  const item = railItem(key);
  return createElement(
    Fragment,
    null,
    createElement("div", { "data-column": "left" }, createElement(item.left.render)),
    createElement("div", { "data-column": "main" }, createElement(item.main.render)),
  );
};

const query = <T extends Element>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`nothing matched ${selector}`);
  }
  return found;
};

/** The toggle for one group, found by the group it narrows. */
const toggle = (root: ParentNode, group: string): HTMLButtonElement =>
  query<HTMLButtonElement>(root, `[data-group-item="${group}"]`);

/** The main column's own subtree, where no narrowing control belongs. */
const mainColumn = (root: ParentNode): HTMLElement => query(root, '[data-column="main"]');

/**
 * Awaited, and that is the point.
 *
 * A press on a toggle does not change anything directly any more: it writes to the
 * query string, and the tree re-renders when the write comes back. nuqs queues
 * the write, so a click that is not flushed returns before the URL has moved, and
 * an assertion straight after it would be reading the list as it was before the
 * press. Every test here that presses something awaits it.
 */
const click = async (element: EventTarget): Promise<void> => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const rows = (root: ParentNode): number => root.querySelectorAll("[data-row]").length;

/**
 * One group per filtering view, and what field a row carries it in.
 *
 * The counts are worked out rather than written down. They used to be literals
 * from the app's own records — "high leaves 3 of 8" — which is a second copy of
 * the data in the test that is checking the data is displayed. They are computed
 * from `tests/fixtures.ts` now, so a fixture change moves them and a record
 * change in the service cannot.
 *
 * The group is one the fixtures actually contain, because a filter that matches
 * nothing has its own tests further down and testing it here as well would only
 * prove that an empty list renders as an empty list.
 *
 * `settlement/runs` is not in this list because its vocabulary is derived rather
 * than sent, so its group is not a field on the row; it has its own block below.
 */
const FILTERS = [
  // Every one of these sections publishes a vocabulary, so every one of them has
  // a left column. The four sections that publish none are asserted in
  // `tests/summary.test.ts`, against the config rather than the markup.
  { section: "alerts/feed", group: "high", field: "severity" },
  { section: "infrastructure/nodes", group: "ixp", field: "kind" },
  { section: "settlement/movements", group: "payout", field: "kind" },
  { section: "slas/commitments", group: "breached", field: "state" },
] as const;

/** How many of a section's fixture rows are on `group`. */
function remainingIn(section: ConsoleSectionKey, field: string, group: string): number {
  const rows = consoleFixtures[section].data as unknown as Record<string, unknown>[];
  return rows.filter((row) => row[field] === group).length;
}

/** How many rows a section has before anything is filtered. */
function totalIn(section: ConsoleSectionKey): number {
  const rows = consoleFixtures[section].data;
  return Array.isArray(rows) ? rows.length : 0;
}

describe("a column that narrows", () => {
  for (const { section: name, group, field: groupField } of FILTERS) {
    const remaining = remainingIn(name, groupField, group);
    const total = totalIn(name);

    test(`the ${name} list is the whole list to begin with`, () => {
      const container = mount(columns(name));
      expect(rows(container)).toBe(total);
      expect(toggle(container, group).getAttribute("aria-pressed")).toBe("false");
    });

    test(`the ${name} column narrows the list beside it`, async () => {
      const container = mount(columns(name));
      await click(toggle(container, group));
      expect(rows(container)).toBe(remaining);
      expect(toggle(container, group).getAttribute("aria-pressed")).toBe("true");
    });

    test(`a second toggle in ${name} adds to the first`, async () => {
      // Union, not replace. Filtering by two severities has to show both, and a
      // column where the last toggle wins reads as a dropdown that forgot it is
      // multi-select.
      const container = mount(columns(name));
      await click(toggle(container, group));
      const other = query<HTMLButtonElement>(
        container,
        '[data-group-item]:not([aria-pressed="true"])',
      );
      const otherGroup = other.getAttribute("data-group-item") as string;
      const otherCount = Number(other.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0);
      const afterOne = rows(container);
      await click(other);
      expect(rows(container)).toBe(afterOne + otherCount);
      expect(otherGroup).not.toBe(group);
    });

    test(`pressing a toggle in ${name} again takes the filter off`, async () => {
      const container = mount(columns(name));
      const target = toggle(container, group);
      await click(target);
      const filtered = rows(container);
      await click(target);
      expect(rows(container)).toBeGreaterThan(filtered);
      expect(target.getAttribute("aria-pressed")).toBe("false");
    });

    test(`the ${name} main column holds no narrowing control of its own`, () => {
      // The failure this rules out is not a missing toggle: it is a second one.
      // Two controls for one filter means the operator presses one, watches the
      // list change, and cannot tell which of the two the other one is for — and
      // the count under the heading, if there is one, says a number the filter has
      // already changed.
      const container = mount(columns(name));
      const column = mainColumn(container);
      expect(column.querySelectorAll("[data-group-item]").length, name).toBe(0);
      expect(column.querySelectorAll("[aria-pressed]").length, name).toBe(0);
    });
  }

  test("a group appears exactly once on the screen", () => {
    // One filter, one control. This is asserted over the whole tree rather than
    // per column, so a column that grew the other's vocabulary — four alerts
    // sections on one view, all of them narrowing by severity — fails here.
    for (const { section: name, group } of FILTERS) {
      const container = mount(columns(name));
      expect(container.querySelectorAll(`[data-group-item="${group}"]`).length, name).toBe(1);
    }
  });

  test("the column says so rather than going quiet", () => {
    // Every toggle is a button with aria-pressed, and the column is marked. A
    // control that looks like a toggle and is a <span> is the failure this rules
    // out.
    for (const { section: name } of FILTERS) {
      const container = mount(columns(name));
      const column = query(container, '[data-column="left"]');
      expect(column.querySelector("[data-scope-panel]"), name).not.toBeNull();
      const toggles = column.querySelectorAll("[data-group-item][aria-pressed]");
      expect(toggles.length, name).toBeGreaterThan(0);
      for (const element of toggles) {
        expect(element.tagName, name).toBe("BUTTON");
      }
    }
  });
});

describe("the filter in the address bar", () => {
  /**
   * The half of the change that is not visible in the tree.
   *
   * The filter is in the query string, so what an operator sends somebody else
   * is the filter and the list. A test that presses a chip and counts rows proves
   * the two halves agree on screen; these prove the half that leaves the
   * browser, which is the half that was the reason for putting it there.
   */
  test("a press writes the group into the query string", async () => {
    const container = mount(columns("alerts/feed"));
    await click(toggle(container, "high"));
    expect(await url(container)).toBe("?alerts-feed=high");
  });

  test("two groups are one key, in the order they were pressed", async () => {
    const container = mount(columns("alerts/feed"));
    await click(toggle(container, "high"));
    await click(toggle(container, "critical"));
    expect(await url(container)).toBe("?alerts-feed=high,critical");
  });

  test("taking the last group off takes the key with it", async () => {
    // Not `?alerts-feed=`. A key left sitting there empty is a URL that reads as
    // though something were filtered, and it is the first thing anyone
    // hand-cleans off a link before sending it.
    const container = mount(columns("alerts/feed"));
    await click(toggle(container, "high"));
    await click(toggle(container, "high"));
    expect(await url(container)).toBe("");
  });

  test("a link arrives with its filter already in force", () => {
    const container = mount(columns("alerts/feed"), "?alerts-feed=high");
    expect(rows(container)).toBe(remainingIn("alerts/feed", "severity", "high"));
    expect(toggle(container, "high").getAttribute("aria-pressed")).toBe("true");
  });

  test("one section's key does not filter another", () => {
    // `infrastructure/nodes` and `settlement/movements` both filter on "kind",
    // and four sections filter on "severity", so a shared `?kind=` would carry
    // the settlement section's `payout` into the infrastructure one, match no
    // node, and show an empty list with no chip pressed: a filter nobody set and
    // nobody can see.
    const container = mount(columns("infrastructure/nodes"), "?settlement-movements=payout");
    expect(rows(container)).toBe(totalIn("infrastructure/nodes"));
    for (const element of container.querySelectorAll("[data-group-item]")) {
      expect(element.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("one section of a view does not filter its sibling", () => {
    // `nodes` and `headroom` are the same rows and the same kind vocabulary, and
    // they are still two destinations with two filters. Arriving at headroom is a
    // fresh look at the network's room, not the nodes list with a filter on it.
    const container = mount(columns("infrastructure/headroom"), "?infrastructure-nodes=ixp");
    expect(rows(container)).toBe(totalIn("infrastructure/headroom"));
    for (const element of container.querySelectorAll("[data-group-item]")) {
      expect(element.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("a link naming a group this section does not have says so", () => {
    // Honest rather than forgiving. The URL says `?infrastructure-nodes=nonsense`,
    // so the list is empty and the empty state explains it. Quietly ignoring the
    // key would show a list that does not match the address bar being looked at,
    // which is the one thing an address bar must never do.
    const container = mount(columns("infrastructure/nodes"), "?infrastructure-nodes=nonsense");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No nodes match these kinds");
  });
});

describe("a column built from a vocabulary the service did not send", () => {
  /**
   * `settlement/runs`, which is the odd one out of the twelve.
   *
   * A run's state is not one of the payload's `meta.groups`, so the column derives
   * two — `completed` and `failed` — from the rows themselves. That is the case
   * worth pressing on: a vocabulary the service did not send is a vocabulary that
   * can quietly disagree with the rows it was derived from, and the disagreement
   * shows up as a count the operator has stopped believing rather than as an error.
   *
   * So the filter is driven both ways here. From the URL, because that is what a
   * link does; and by a press, because the derivation has to survive the list
   * being re-read.
   */
  test("the groups are the two a run can be in", () => {
    const container = mount(columns("settlement/runs"));
    expect(consoleFixtures["settlement/runs"].meta.groups).toEqual([]);
    const groups = [...container.querySelectorAll("[data-group-item]")].map((element) =>
      element.getAttribute("data-group-item"),
    );
    expect(groups).toEqual(["completed", "failed"]);
  });

  test("pressing a derived group narrows the list to the runs in it", async () => {
    const container = mount(columns("settlement/runs"));
    const failed = toggle(container, "failed");
    const count = Number(failed.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0);
    expect(count).toBeGreaterThan(0);
    await click(failed);
    expect(rows(container)).toBe(count);
    expect(container.textContent).toContain(
      `of ${consoleFixtures["settlement/runs"].data.length} runs`,
    );
  });

  test("a link naming a derived group filters it, and an unknown one says so", () => {
    const runs = consoleFixtures["settlement/runs"].data;
    const completed = runs.filter((row) => row.failed === 0).length;
    const byUrl = mount(columns("settlement/runs"), "?settlement-runs=completed");
    expect(rows(byUrl)).toBe(completed);

    const unknown = mount(columns("settlement/runs"), "?settlement-runs=nonsense");
    expect(rows(unknown)).toBe(0);
    expect(unknown.textContent).toContain("No runs match");
  });
});

describe("a filter that matches nothing", () => {
  /**
   * A group the service names and the fixtures hold nothing for, in each of the
   * four filtering views.
   *
   * The chip is still there, because the vocabulary travels with the rows: a chip
   * that disappeared at zero would be a chip that could not be pressed while the
   * data was still loading, and a group with no rows this week still has to have
   * somewhere to be pressed into.
   */
  const EMPTY_CASES = [
    {
      section: "infrastructure/nodes",
      group: "cdn_edge",
      message: "No nodes match these kinds",
    },
    { section: "settlement/movements", group: "escrow", message: "No movements match the filter" },
    { section: "slas/commitments", group: "at_risk", message: "No commitments match these states" },
    { section: "alerts/feed", group: "medium", message: "No alerts match these severities" },
  ] as const satisfies readonly { section: ConsoleSectionKey; group: string; message: string }[];

  for (const { section: name, group, message } of EMPTY_CASES) {
    test(`the ${name} section says so rather than leaving an empty column`, async () => {
      const container = mount(columns(name));
      await click(toggle(container, group));
      expect(rows(container)).toBe(0);
      expect(container.textContent).toContain(message);
    });

    test(`the ${name} vocabulary names ${group} even with no rows on it`, () => {
      // The chip exists because the service sent the group, not because a row
      // does. This is asserted against `meta.groups` rather than against the
      // rendered bar, because it is the payload that has to carry it.
      expect(consoleFixtures[name].meta.groups as readonly string[]).toContain(group);
    });
  }
});

/** The same lookup, for asserting a thing is *not* there. */
const maybe = <T extends Element>(root: ParentNode, selector: string): T | null =>
  root.querySelector<T>(selector);

describe("the SLA column", () => {
  /**
   * The column counts the states, and the list beside it is what it counted.
   *
   * The state on each row is the one the service computed and sent. A column built
   * from the state a browser decided for itself would count a commitment as
   * breached that no settlement run would ever issue a credit for, which is the one
   * number in this console that decides money.
   */
  test("it draws the vocabulary, so the counts below are about the filter", () => {
    // Without this the rest of these pass on an empty list.
    const container = mount(columns("slas/commitments"));
    expect(rows(container)).toBe(consoleFixtures["slas/commitments"].data.length);
  });

  test("it is a toggle per state, with nothing in it that is not one", () => {
    // Asserted as the absence of a second control, because that is what a column
    // that grew a search field again would look like: a toggle per state, plus a
    // text box sharing the column with them.
    const container = mount(columns("slas/commitments"));
    for (const state of ["compliant", "at_risk", "breached"]) {
      expect(query(container, `[data-group-item="${state}"]`)).not.toBeNull();
    }
    expect(maybe(container, '[role="searchbox"]')).toBeNull();
  });

  test("a state toggle narrows the list", async () => {
    const container = mount(columns("slas/commitments"));
    await click(toggle(container, "breached"));
    expect(rows(container)).toBe(
      consoleFixtures["slas/commitments"].data.filter((row) => row.state === "breached").length,
    );
  });

  test("a state with no commitments says so rather than showing an empty list", () => {
    // A state the service's vocabulary names and this fixture has nothing on, so
    // this is the filter that opens a panel with nothing in it. Driven from the
    // URL because the fixture's two rows are compliant and breached.
    const container = mount(columns("slas/commitments"), "?slas-commitments=at_risk");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No commitments match these states");
  });
});

describe("the count line above the toggles", () => {
  test("it says how many rows are in force out of how many there are", () => {
    // The number the operator checks the table against. It is in the column rather
    // than under the heading because it is the count the filter changed, and a
    // count somewhere else is one somebody stops checking.
    const container = mount(columns("slas/commitments"));
    const line = query(container, "[data-scope-count]");
    const total = consoleFixtures["slas/commitments"].data.length;
    expect(line.textContent).toBe(`${total} of ${total} commitments`);
  });

  test("it moves when the filter does", async () => {
    const breached = consoleFixtures["slas/commitments"].data.filter(
      (row) => row.state === "breached",
    ).length;
    const container = mount(columns("slas/commitments"));
    await click(toggle(container, "breached"));
    const line = query(container, "[data-scope-count]");
    const total = consoleFixtures["slas/commitments"].data.length;
    expect(line.textContent).toBe(`${breached} of ${total} commitments`);
  });

  test("clearing puts every row back and takes the button with it", async () => {
    // The button only exists while something is in force: a "clear" with nothing
    // to clear is a control that admits the filter is not the operator's own doing.
    const container = mount(columns("slas/commitments"));
    expect(maybe(container, "[data-scope-clear]")).toBeNull();
    await click(toggle(container, "breached"));
    const clear = query<HTMLButtonElement>(container, "[data-scope-clear]");
    await click(clear);
    expect(rows(container)).toBe(consoleFixtures["slas/commitments"].data.length);
    expect(maybe(container, "[data-scope-clear]")).toBeNull();
  });
});

describe("a column over data that has not arrived", () => {
  test("it says it is loading rather than offering empty groups", () => {
    // "0 of 0 nodes" over a service that has not answered is a claim about the
    // world, and a group the reader presses to find out why is a group with
    // nothing in it because nothing has loaded. `tests/query.test.ts` covers the
    // third state — a service that answered with an error.
    const pending = mount(columns("infrastructure/nodes"), "", emptyQueryClient());
    expect(pending.textContent).toContain("Loading nodes");
    expect(maybe(pending, "[data-group-item]")).toBeNull();
  });
});

describe("visibleBy", () => {
  const rows = [
    { kind: "clearing", n: 1 },
    { kind: "clearing", n: 2 },
    { kind: "payout", n: 3 },
  ];
  const of = (row: { kind: string }): string => row.kind;

  test("nothing selected is everything", () => {
    // The rule four views depend on and that one of them would get wrong: a
    // filter that shows nothing when its last chip is turned off is a view that
    // empties itself and cannot be emptied back.
    expect(visibleBy(rows, of, [])).toHaveLength(3);
  });

  test("one selection is that group", () => {
    expect(visibleBy(rows, of, ["clearing"])).toHaveLength(2);
  });

  test("two selections are both", () => {
    expect(visibleBy(rows, of, ["clearing", "payout"])).toHaveLength(3);
  });

  test("a selection nothing matches is empty, not everything", () => {
    expect(visibleBy(rows, of, ["escrow"])).toHaveLength(0);
  });

  test("it does not hand back the array it was given", () => {
    // The rows are a module constant in four of the five views, and a caller
    // that sorted what it was given would reorder the feed underneath the
    // component that owns it.
    const source = [...rows];
    expect(visibleBy(source, of, [])).not.toBe(source);
    expect(visibleBy(source, of, [])).toEqual(source);
  });
});
