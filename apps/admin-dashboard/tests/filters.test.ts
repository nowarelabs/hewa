// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { config } from "../src/app/shell.config";
import type { FlightData } from "../src/app/hooks";
import { visibleBy } from "../src/app/ui/primitives";

/**
 * The summary bar, filtered, and the filter in the address bar.
 *
 * The bar counted the rows below it and did nothing with the counts, which is
 * the shape of a control that is nearly a control: the only reason to read
 * "High: 3" is to go and look at the three high alerts, and the count was
 * answering a question it could have asked itself.
 *
 * So this asks whether it does. Every test here is the same claim in a
 * different view, because a morph that works in the alerts view and not in the
 * osint one is two implementations wearing one name.
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
const realFetch = globalThis.fetch;

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

/** The same thing parsed, for asserting on one key without depending on order. */
const params = async (container: HTMLElement): Promise<URLSearchParams> =>
  new URLSearchParams(await url(container));

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
 * The views whose bar is a breakdown of their rows, and what a row is in each.
 *
 * The row marker is the only thing shared by a list of articles and a table of
 * rows, and it is what these tests count. Without it they would be counting tag
 * names, which a view is free to change.
 */
const FILTERS = [
  { view: "alerts", group: "high", remaining: 3, total: 8 },
  { view: "conflicts", group: "armed", remaining: 1, total: 5 },
  // The key is `cia` and the label is `CIA`. Looking the chip up by its label is
  // how this file's first draft found nothing and reported eight rows for a
  // filter it thought it had applied.
  { view: "osint", group: "cia", remaining: 1, total: 8 },
  { view: "satellites", group: "reconnaissance", remaining: 2, total: 5 },
] as const;

describe("a bar that filters", () => {
  for (const { view: name, group, remaining, total } of FILTERS) {
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
    // The streams view has aria-pressed all over it, on the channel buttons.
    // The bar is what has to be free of them.
    for (const name of ["streams", "economic"]) {
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
    expect(rows(container)).toBe(3);
    expect(chip(container, "high").getAttribute("aria-pressed")).toBe("true");
  });

  test("one view's key does not filter another", () => {
    // Conflicts and satellites both group their rows by kind, which is why the
    // key is named after the view. A shared `?kind=` would carry the satellites
    // view's `weather` into the conflicts view, match no incident, and show an
    // empty list with no chip pressed: a filter nobody set and nobody can see.
    const container = mount(view("conflicts"), "?satellites=weather");
    expect(rows(container)).toBe(5);
    for (const element of container.querySelectorAll("[data-summary-item]")) {
      expect(element.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("a link naming a group this view does not have says so", () => {
    // Honest rather than forgiving. The URL says `?osint=nonsense`, so the list
    // is empty and the empty state explains it. Quietly ignoring the key would
    // show a list that does not match the address bar being looked at, which is
    // the one thing an address bar must never do.
    const container = mount(view("osint"), "?osint=nonsense");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No reports match these categories");
  });
});

describe("a filter that matches nothing", () => {
  const EMPTY_CASES = [
    { view: "conflicts", group: "election", message: "No incidents match these kinds" },
    { view: "satellites", group: "weather", message: "No satellites match these kinds" },
  ] as const;

  for (const { view: name, group, message } of EMPTY_CASES) {
    test(`the ${name} view says so rather than leaving an empty column`, async () => {
      // A group the view knows about and has no rows for. The chip is still
      // there, because the counts come out of the rows and the rows arrive
      // after the bar does — a chip that disappeared at zero would be a chip
      // that could not be pressed while the data was still loading.
      const container = mount(view(name));
      await click(chip(container, group));
      expect(rows(container)).toBe(0);
      expect(container.textContent).toContain(message);
    });
  }
});

/**
 * The flights worker's answer, shared by the two flights describes below.
 *
 * Four rows across three carriers, so a carrier chip and a callsign search can
 * be told apart: "KQ" is two rows, Safarilink is one, and the two have no
 * flight in common.
 */
const FLIGHTS: FlightData[] = [
  {
    icao24: "a1",
    callsign: "KQ100",
    originCountry: "Kenya",
    latitude: 1,
    longitude: 36,
    altitude: 10_000,
    velocity: 240,
    heading: 90,
    isArriving: false,
    isDeparting: true,
  },
  {
    icao24: "a2",
    callsign: "KQ200",
    originCountry: "Kenya",
    latitude: 2,
    longitude: 37,
    altitude: 11_000,
    velocity: 250,
    heading: 91,
    isArriving: false,
    isDeparting: true,
  },
  {
    icao24: "b1",
    callsign: "FY300",
    originCountry: "Kenya",
    latitude: 3,
    longitude: 38,
    altitude: 9_000,
    velocity: 230,
    heading: 92,
    isArriving: false,
    isDeparting: true,
  },
  {
    icao24: "c1",
    callsign: "XK400",
    originCountry: "Tanzania",
    latitude: 4,
    longitude: 39,
    altitude: 8_000,
    velocity: 220,
    heading: 93,
    isArriving: true,
    isDeparting: false,
  },
];

/**
 * Stubbed rather than left to fail, because the loading and error states render
 * no rows at all and every assertion about flights is about rows.
 */
const stubWorker = async (searchParams = ""): Promise<HTMLElement> => {
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ timestamp: 0, total: FLIGHTS.length, flights: FLIGHTS }),
    }) as unknown as Response) as typeof fetch;
  const container = mount(view("flights"), searchParams);
  await act(async () => {});
  return container;
};

const field = (container: HTMLElement): HTMLInputElement =>
  query<HTMLInputElement>(container, '[role="searchbox"]');

const type = async (container: HTMLElement, value: string): Promise<void> => {
  const input = field(container);
  // The prototype's own setter, not `input.value = …`. React installs a value
  // tracker on the element and drops the change event when the value it holds is
  // the one it is handed, so assigning the property updates the DOM and leaves
  // React's state where it was — which reads as a search field that types
  // without filtering.
  //
  // The descriptor is retyped rather than narrowed at the use site: `value` is
  // declared as a method in the DOM types, and a method reference is exactly
  // what the unbound-method rule is about. The receiver is passed explicitly, so
  // there is no unbound call here for it to warn about.
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") as
    | { set?: (next: string) => void }
    | undefined;
  await act(async () => {
    if (descriptor?.set !== undefined) {
      Reflect.apply(descriptor.set, input, [value]);
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the flights bar", () => {
  /**
   * The one view with both controls, and the reason it is the one is that the
   * two answer different questions: a carrier says how many there are, a
   * callsign says which one you meant.
   */
  test("it loads the worker's rows, so the counts below are about the filter", () => {
    // Without this the rest of these pass on an empty table.
    return stubWorker().then((container) => {
      expect(rows(container)).toBe(4);
    });
  });

  test("it has a search field and a chip per carrier", async () => {
    const container = await stubWorker();
    expect(field(container)).not.toBeNull();
    for (const carrier of ["Kenya Airways", "Fly540", "Safarilink"]) {
      expect(query(container, `[data-summary-item="${carrier}"]`)).not.toBeNull();
    }
  });

  test("a carrier chip narrows the table", async () => {
    const container = await stubWorker();
    await click(chip(container, "Safarilink"));
    expect(rows(container)).toBe(1);
  });

  test("the search field narrows the table by callsign", async () => {
    const container = await stubWorker();
    await type(container, "KQ");
    expect(rows(container)).toBe(2);
  });

  test("a search that matches nothing says so", async () => {
    const container = await stubWorker();
    await type(container, "zzzz");
    expect(rows(container)).toBe(0);
    expect(container.textContent).toContain("No flights match this carrier or search");
  });

  test("the search reports how much of the table it left", async () => {
    // "3 of 800" is the difference between a search and a disappearance.
    const container = await stubWorker();
    await type(container, "KQ");
    expect(field(container).value).toBe("KQ");
    expect(container.textContent).toContain("2 of 4");
  });

  test("the two controls compose, and the search cannot undo the chip", async () => {
    // Safarilink and "KQ" have no flight in common. A search that ran against
    // the unfiltered table would report the two Kenya Airways rows, which is the
    // one way this can be silently wrong.
    const container = await stubWorker();
    await type(container, "KQ");
    expect(rows(container)).toBe(2);
    await click(chip(container, "Safarilink"));
    expect(rows(container)).toBe(0);
  });

  test("clearing the search leaves the chip in force", async () => {
    const container = await stubWorker();
    await type(container, "KQ");
    await click(chip(container, "Safarilink"));
    expect(rows(container)).toBe(0);
    await type(container, "");
    expect(rows(container)).toBe(1);
  });
});

describe("the flights search in the address bar", () => {
  test("what is typed reaches the query string", async () => {
    const container = await stubWorker();
    await type(container, "KQ");
    expect((await params(container)).get("flightsQ")).toBe("KQ");
  });

  test("a carrier and a search are two keys, and both survive", async () => {
    const container = await stubWorker();
    await type(container, "KQ");
    await click(chip(container, "Safarilink"));
    expect((await params(container)).get("flights")).toBe("Safarilink");
    expect((await params(container)).get("flightsQ")).toBe("KQ");
  });

  test("clearing the search takes its key out and leaves the carrier's", async () => {
    const container = await stubWorker();
    await type(container, "KQ");
    await click(chip(container, "Safarilink"));
    await type(container, "");
    expect((await params(container)).has("flightsQ")).toBe(false);
    expect((await params(container)).get("flights")).toBe("Safarilink");
  });

  test("a link arrives searched, with the text in the box", async () => {
    // The field is populated from the URL and not left empty over a filtered
    // table, which is the state that makes an operator type the same query
    // again because the console has forgotten what they already said.
    const container = await stubWorker("?flightsQ=KQ");
    expect(rows(container)).toBe(2);
    expect(field(container).value).toBe("KQ");
  });
});

describe("visibleBy", () => {
  const rows = [
    { kind: "armed", n: 1 },
    { kind: "armed", n: 2 },
    { kind: "protest", n: 3 },
  ];
  const of = (row: { kind: string }): string => row.kind;

  test("nothing selected is everything", () => {
    // The rule five views depend on and that one of them would get wrong: a
    // filter that shows nothing when its last chip is turned off is a view that
    // empties itself and cannot be emptied back.
    expect(visibleBy(rows, of, [])).toHaveLength(3);
  });

  test("one selection is that group", () => {
    expect(visibleBy(rows, of, ["armed"])).toHaveLength(2);
  });

  test("two selections are both", () => {
    expect(visibleBy(rows, of, ["armed", "protest"])).toHaveLength(3);
  });

  test("a selection nothing matches is empty, not everything", () => {
    expect(visibleBy(rows, of, ["election"])).toHaveLength(0);
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
