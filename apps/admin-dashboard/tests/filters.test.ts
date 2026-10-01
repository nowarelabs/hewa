// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { QueryClientProvider } from "@tanstack/react-query";
import { config } from "../src/app/shell.config";
import { visibleBy } from "../src/app/ui/primitives";
import { consoleFixtures } from "./fixtures";
import { seededQueryClient } from "./harness";

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
 * The summary bar, filtered, and the filter in the address bar.
 *
 * The bar counted the rows below it and did nothing with the counts, which is
 * the shape of a control that is nearly a control: the only reason to read
 * "High: 1" is to go and look at the one high alert, and the count was answering
 * a question it could have asked itself.
 *
 * So this asks whether it does. Every test here is the same claim in a
 * different view, because a morph that works in the alerts view and not in the
 * SLAs one is two implementations wearing one name.
 *
 * The second claim is the harder one. The filter state is in the query string,
 * not in a component, so half of what is worth checking cannot be seen in the
 * tree at all: whether a press wrote the key, whether a second press took it
 * away, and whether the URL a colleague opens says what the operator saw.
 */

declare global {
  // `var` is the only thing a `declare global` can hold, and this is React's own
  // flag: it is what tells `act` it is running in a test rather than in a page.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

/**
 * The query string each mount's adapter last wrote, keyed by its container.
 *
 * Per mount, and not one shared slot. nuqs keeps its URL update queue in a
 * module-level global, and a throttled write from an earlier test can land after
 * the next one has mounted — with a single shared slot, that late write
 * overwrites the current test's value and the test fails on the *previous* test's
 * URL. Keying by container means a late write can only ever be read by the test
 * that caused it.
 */
const written = new WeakMap<HTMLElement, string>();

/**
 * Mounted under nuqs' own testing adapter, with memory on, so the tree reads the
 * same in-memory query string the app would read the real one from.
 *
 * `hasMemory` is the part that matters: without it the adapter freezes the
 * initial params and every press would be asserted against a URL that never
 * moved, and the tests would pass on a filter that filtered but never wrote.
 */
const mount = (element: ReactElement, searchParams = ""): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  written.set(container, "");
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: seededQueryClient() },
        createElement(NuqsTestingAdapter, {
          hasMemory: true,
          searchParams,
          onUrlUpdate: (event) => {
            written.set(container, event.queryString);
          },
          // In the props object rather than as a third argument to
          // `createElement`. The adapter declares `children` as a required prop
          // rather than the optional `PropsWithChildren` shape, and a required
          // `children` is not satisfied by the variadic overload.
          children: element,
        }),
      ),
    ),
  );
  roots.push(root);
  return container;
};

/**
 * Let the query string catch up with the tree.
 *
 * nuqs rate-limits its URL writes — 50ms by default, and the search box asks for
 * 400ms — and coalesces the presses inside that window into one write. So the
 * tree updates on the press and the URL follows a moment later, and a test that
 * reads the URL the instant after a press is reading a race. Whether the leading
 * or the trailing edge of the window wins depends on the machine, which is how
 * this file passed four runs in a row and then failed on the sixth.
 *
 * The readers below await it, so an assertion about the URL cannot forget to.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
};

/** The query string that mount last wrote, or `""` if it has not written one. */
const url = async (container: HTMLElement): Promise<string> => {
  await settle();
  return written.get(container) ?? "";
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

const view = (key: string): ReactElement => {
  const found = config.views[key];
  if (found === undefined) {
    throw new Error(`no view called ${key}`);
  }
  return createElement(found.main.render);
};

const query = <T extends Element>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`nothing matched ${selector}`);
  }
  return found;
};

/** The chip for one group, found by the group it filters on. */
const chip = (root: ParentNode, group: string): HTMLButtonElement =>
  query<HTMLButtonElement>(root, `[data-summary-item="${group}"]`);

/**
 * Awaited, and that is the point.
 *
 * A press on a chip does not change anything directly any more: it writes to the
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
 */
const FILTERS = [
  // Every one of these lists groups its rows, so every one of these bars is a
  // filter; `market` is the document, and its bar holds figures instead.
  { view: "alerts", group: "high", field: "severity" },
  { view: "infrastructure", group: "ixp", field: "kind" },
  { view: "settlement", group: "payout", field: "kind" },
  { view: "slas", group: "breached", field: "state" },
] as const;

/** How many of a view's fixture rows are on `group`. */
function remainingIn(view: string, field: string, group: string): number {
  const rows = consoleFixtures[view as keyof typeof consoleFixtures].data as {
    [key: string]: unknown;
  }[];
  return rows.filter((row) => row[field] === group).length;
}

/** How many rows a view has before anything is filtered. */
function totalIn(view: string): number {
  return (consoleFixtures[view as keyof typeof consoleFixtures].data as unknown[]).length;
}

describe("a bar that filters", () => {
  for (const { view: name, group, field: groupField } of FILTERS) {
    const remaining = remainingIn(name, groupField, group);
    const total = totalIn(name);
    test(`the ${name} list is the whole list to begin with`, () => {
      const container = mount(view(name));
      expect(rows(container)).toBe(total);
      expect(chip(container, group).getAttribute("aria-pressed")).toBe("false");
    });

    test(`the ${name} bar filters the list beneath it`, async () => {
      const container = mount(view(name));
      await click(chip(container, group));
      expect(rows(container)).toBe(remaining);
      expect(chip(container, group).getAttribute("aria-pressed")).toBe("true");
    });

    test(`a second chip in ${name} adds to the first`, async () => {
      // Union, not replace. Filtering by two severities has to show both, and a
      // bar where the last chip wins reads as a dropdown that forgot it is
      // multi-select.
      const container = mount(view(name));
      const first = chip(container, group);
      await click(first);
      const other = query<HTMLButtonElement>(
        container,
        '[data-summary-item]:not([aria-pressed="true"])',
      );
      const otherGroup = other.getAttribute("data-summary-item") as string;
      const otherCount = Number(other.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0);
      const afterOne = rows(container);
      await click(other);
      expect(rows(container)).toBe(afterOne + otherCount);
      expect(otherGroup).not.toBe(group);
    });

    test(`clicking a chip in ${name} again takes the filter off`, async () => {
      const container = mount(view(name));
      const target = chip(container, group);
      await click(target);
      const filtered = rows(container);
      await click(target);
      expect(rows(container)).toBeGreaterThan(filtered);
      expect(target.getAttribute("aria-pressed")).toBe("false");
    });
  }

  test("a filter says so rather than going quiet", () => {
    // Every chip is a button with aria-pressed, and every bar is marked. A chip
    // that looks like a toggle and is a <span> is the failure this rules out.
    for (const { view: name } of FILTERS) {
      const container = mount(view(name));
      const bar = query(container, "[data-summary-bar]");
      expect(bar.hasAttribute("data-filterable")).toBe(true);
      const chips = bar.querySelectorAll("[data-summary-item][aria-pressed]");
      expect(chips.length).toBeGreaterThan(0);
      for (const element of chips) {
        expect(element.tagName).toBe("BUTTON");
      }
    }
  });

  test("a bar that is not a filter holds no toggles of its own", () => {
    // The market view is the one left: it counts aggregates rather than rows, so
    // there is nothing for a chip to filter. Asserted for the view that has the
    // least reason to grow one.
    for (const name of ["market"]) {
      const container = mount(view(name));
      const bar = query(container, "[data-summary-bar]");
      expect(bar.hasAttribute("data-filterable")).toBe(false);
      expect(bar.querySelectorAll("[aria-pressed]").length).toBe(0);
      expect(bar.querySelectorAll("button").length).toBe(0);
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
    const container = mount(view("alerts"));
    await click(chip(container, "high"));
    expect(await url(container)).toBe("?alerts=high");
  });

  test("two groups are one key, in the order they were pressed", async () => {
    const container = mount(view("alerts"));
    await click(chip(container, "high"));
    await click(chip(container, "critical"));
    expect(await url(container)).toBe("?alerts=high,critical");
  });

  test("taking the last group off takes the key with it", async () => {
    // Not `?alerts=`. A key left sitting there empty is a URL that reads as
    // though something were filtered, and it is the first thing anyone
    // hand-cleans off a link before sending it.
    const container = mount(view("alerts"));
    await click(chip(container, "high"));
    await click(chip(container, "high"));
    expect(await url(container)).toBe("");
  });

  test("a link arrives with its filter already in force", () => {
    const container = mount(view("alerts"), "?alerts=high");
    expect(rows(container)).toBe(remainingIn("alerts", "severity", "high"));
    expect(chip(container, "high").getAttribute("aria-pressed")).toBe("true");
  });

  test("one view's key does not filter another", () => {
    // The infrastructure view and the settlement view both group their rows by
    // "kind", which is why the key is named after the view. A shared `?kind=`
    // would carry the settlement view's `payout` into the infrastructure view,
    // match no node, and show an empty list with no chip pressed: a filter nobody
    // set and nobody can see.
    const container = mount(view("infrastructure"), "?settlement=payout");
    expect(rows(container)).toBe(totalIn("infrastructure"));
    for (const element of container.querySelectorAll("[data-summary-item]")) {
      expect(element.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("a link naming a group this view does not have says so", () => {
    // Honest rather than forgiving. The URL says `?infrastructure=nonsense`, so
    // the list is empty and the empty state explains it. Quietly ignoring the key
    // would show a list that does not match the address bar being looked at, which
    // is the one thing an address bar must never do.
    const container = mount(view("infrastructure"), "?infrastructure=nonsense");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No nodes match these kinds");
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
    { view: "infrastructure", group: "cdn_edge", message: "No nodes match these kinds" },
    { view: "settlement", group: "escrow", message: "No movements match these kinds" },
    { view: "slas", group: "at_risk", message: "No commitments match these states" },
    { view: "alerts", group: "medium", message: "No alerts match these severities" },
  ] as const;

  for (const { view: name, group, message } of EMPTY_CASES) {
    test(`the ${name} view says so rather than leaving an empty column`, async () => {
      const container = mount(view(name));
      await click(chip(container, group));
      expect(rows(container)).toBe(0);
      expect(container.textContent).toContain(message);
    });

    test(`the ${name} vocabulary names ${group} even with no rows on it`, () => {
      // The chip exists because the service sent the group, not because a row
      // does. This is asserted against `meta.groups` rather than against the
      // rendered bar, because it is the payload that has to carry it.
      expect(consoleFixtures[name].meta.groups).toContain(group);
    });
  }
});

/** The same lookup, for asserting a thing is *not* there. */
const maybe = <T extends Element>(root: ParentNode, selector: string): T | null =>
  root.querySelector<T>(selector);

describe("the SLA bar", () => {
  /**
   * The bar counts the states, and the list under it is what it counted.
   *
   * The state on each row is the one the service computed and sent. A bar built
   * from the state a browser decided for itself would count a commitment as
   * breached that no settlement run would ever issue a credit for, which is the
   * one number in this console that decides money.
   */
  test("it draws the vocabulary, so the counts below are about the filter", () => {
    // Without this the rest of these pass on an empty list.
    const container = mount(view("slas"));
    expect(rows(container)).toBe(consoleFixtures.slas.data.length);
  });

  test("it is a chip per state, with nothing in it that is not one", () => {
    // Asserted as the absence of a second control, because that is what a bar
    // that grew a search field again would look like: a toggle per state, plus a
    // text box sharing the strip with them.
    const container = mount(view("slas"));
    for (const state of ["compliant", "at_risk", "breached"]) {
      expect(query(container, `[data-summary-item="${state}"]`)).not.toBeNull();
    }
    expect(maybe(container, '[role="searchbox"]')).toBeNull();
  });

  test("a state chip narrows the list", async () => {
    const container = mount(view("slas"));
    await click(chip(container, "breached"));
    expect(rows(container)).toBe(
      consoleFixtures.slas.data.filter((row) => row.state === "breached").length,
    );
  });

  test("a state with no commitments says so rather than showing an empty list", () => {
    // A state the service's vocabulary names and this fixture has nothing on, so
    // this is the filter that opens a panel with nothing in it. Driven from the
    // URL because the fixture's two rows are compliant and breached.
    const container = mount(view("slas"), "?slas=at_risk");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No commitments match these states");
  });
});

describe("the market has no chip bar", () => {
  /**
   * The market is a document, so its bar holds aggregates and takes no `filter`.
   *
   * A chip there would have nothing to filter: the rail already picks the pool,
   * and a toggle that hid half the book on a click would leave an operator
   * wondering which half. A control that hides nothing is a control that lies,
   * which is why `SummaryBar` refuses the combination.
   */
  test("its bar counts figures and holds no toggles", () => {
    const container = mount(view("market"));
    const bar = query(container, "[data-summary-bar]");
    expect(bar.hasAttribute("data-filterable")).toBe(false);
    expect(bar.querySelectorAll("[aria-pressed]").length).toBe(0);
  });

  test("its groups are empty, and a chip built from them would be a type error", () => {
    // `meta.groups: never` for this view is the compile-time half; this is the
    // payload half, and it is what a chip bar would read to build itself.
    expect(consoleFixtures.market.meta.groups).toEqual([]);
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
