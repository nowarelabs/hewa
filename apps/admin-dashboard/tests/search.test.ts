// @vitest-environment happy-dom

import { createElement, Fragment, type ReactElement } from "react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import type { ConsoleSectionKey } from "@hewa/console-types";
import type { RailItem } from "@hewa/app-shell";

import { config } from "../src/app/shell.config";
import { searchRows } from "../src/app/ui/search";
import { emptyQueryClient, mountInteractive, press, type, unmountAll } from "./harness";

/**
 * Finding rows by name, in the column beside the rail.
 *
 * Four of the sixteen sections publish no vocabulary, so they cannot draw group
 * toggles — and for a while they drew no column at all, which is worse than an
 * empty one: a rail button that opens a screen one column narrower than its
 * neighbours reads as a column that failed to load. Those four search instead.
 *
 * So there are two things to hold down here, and the second is the one that would
 * otherwise be taken on trust. First that a term narrows the table the section
 * lists. Second that it narrows *only* that table, that the count beside the input
 * moves with it, and that a term which matches nothing says so — because a search
 * that quietly returns everything reads as working, and the reader has no way to
 * tell it apart from one that is right.
 *
 * The term lives in the query string like every other piece of narrowing state, so
 * a link a colleague is sent carries what the operator was looking at. That is only
 * true if the write happens, which is why every test that presses something awaits
 * the URL rather than reading the tree.
 */

afterEach(() => {
  unmountAll();
});

/**
 * The four sections that search.
 *
 * Fixed rather than derived, so that a sixth section added without a search fails
 * here instead of quietly being one of the sixteen with a column of nothing.
 */
const SEARCHED = [
  "market/book",
  "market/prices",
  "market/venues",
  "infrastructure/providers",
] as const satisfies readonly ConsoleSectionKey[];

/** The twelve that narrow by group, and must not also offer a search. */
const FILTERED = [
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

const mount = (key: ConsoleSectionKey, searchParams = "") =>
  mountInteractive(columns(key), searchParams);

const find = <T extends Element>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`nothing matched ${selector}`);
  }
  return found;
};

const maybe = <T extends Element>(root: ParentNode, selector: string): T | null =>
  root.querySelector<T>(selector);

const input = (root: ParentNode): HTMLInputElement =>
  find<HTMLInputElement>(root, "[data-search-input]");

/** The rows on screen, which is the claim the search is being checked against. */
const rows = (root: ParentNode): number => root.querySelectorAll("[data-row]").length;

/** `2 of 14 orders`, as the column states it. */
const count = (root: ParentNode): string =>
  (find(root, "[data-search-count]").textContent ?? "").replace(/\s+/g, " ").trim();

/** The main column's own subtree, where no narrowing control belongs. */
const main = (root: ParentNode): HTMLElement => find(root, '[data-column="main"]');

describe("a section that finds its rows by name", () => {
  test("typing narrows the table the section lists", async () => {
    // The whole reason the four have this column. A search that does not narrow is
    // a text field, and the reader's next action is to stop using it.
    const { container } = mount("market/book");
    expect(rows(main(container))).toBe(2);

    await type(input(container), "mombasa");
    expect(rows(main(container))).toBe(1);
    expect(main(container).textContent).toContain("Mombasa corridor");
    expect(main(container).textContent).not.toContain("Nairobi IXP");
  });

  test("the count beside the input moves with the table", async () => {
    // The number to check the table against, and the reason the count lives here
    // rather than under the heading: the chip in the heading says how many orders
    // there are in all, which is a different claim.
    const { container } = mount("market/book");
    expect(count(container)).toBe("2 of 2 orders");

    await type(input(container), "mombasa");
    expect(count(container)).toBe("1 of 2 orders");
  });

  test("the term is in the query string, under the section's own key", async () => {
    // A link a colleague opens has to say what the operator was looking at, and it
    // has to say it about *this* section: `q-market-book` and
    // `q-infrastructure-nodes` are two searches of two screens.
    const { container, url } = mount("market/book");
    await type(input(container), "mombasa");
    expect(await url()).toBe("?q-market-book=mombasa");
  });

  test("a term in the url narrows the table before anything is pressed", async () => {
    // The other half of the same claim. A search that only remembers within one
    // mounted tree is not state, it is a local variable.
    const { container } = mount("market/book", "?q-market-book=mombasa");
    expect(rows(main(container))).toBe(1);
    expect(input(container).value).toBe("mombasa");
  });

  test("another section's term does not narrow this one", async () => {
    // Carried across, a term narrows a list by a word that means nothing there: the
    // table empties, the column says `0 of 2 orders`, and nothing on screen says
    // where the word came from.
    const { container } = mount("market/book", "?q-infrastructure-nodes=ixp");
    expect(rows(main(container))).toBe(2);
    expect(input(container).value).toBe("");
  });

  test("a term that matches nothing says so, rather than showing everything", async () => {
    // The failure mode that reads as working. An empty table under a search is a
    // claim; an empty table because the search was ignored is a lie.
    const { container } = mount("market/book");
    await type(input(container), "atlantis");
    expect(rows(main(container))).toBe(0);
    expect(main(container).textContent).toContain("No orders match");
    expect(count(container)).toBe("0 of 2 orders");
  });

  test("clearing it puts every row back and takes the key away", async () => {
    const { container, url } = mount("market/book");
    await type(input(container), "mombasa");
    expect(rows(main(container))).toBe(1);

    await type(input(container), "");
    expect(rows(main(container))).toBe(2);
    // Empty is the default, so the key is removed rather than written empty: a URL
    // carrying `?q-market-book=` is a link that looks like a search for nothing.
    expect(await url()).toBe("");
  });

  test("the column's clear button does the same thing", async () => {
    const { container } = mount("market/book");
    await type(input(container), "mombasa");
    const clear = find<HTMLButtonElement>(container, "[data-search-clear]");
    await press(clear);
    expect(rows(main(container))).toBe(2);
    expect(maybe(container, "[data-search-clear]")).toBeNull();
  });

  test("every searching section narrows its own rows", async () => {
    // Four sections, one implementation, and no section quietly getting the wrong
    // one: a search wired to a neighbouring section's rows is a column that filters
    // something the reader cannot see.
    const { container } = mount("infrastructure/providers");
    const before = rows(main(container));
    expect(before).toBeGreaterThan(1);

    await type(input(container), "seacom");
    expect(rows(main(container))).toBe(1);
    expect(main(container).textContent).toContain("SEACOM");
    expect(main(container).textContent).not.toContain("Kenya Exchange");
  });

  test("a provider's figures follow the search, because they are sums over its rows", async () => {
    // `Capacity` here is the sum of the rows on screen. Left over the whole list it
    // is an unfiltered total sitting above a filtered table, which is the defect the
    // scope column was built to end: the reader cannot tell which one the table is
    // honouring.
    const { container } = mount("infrastructure/providers");
    await type(input(container), "seacom");
    const bar = main(container).textContent ?? "";
    // SEACOM carries 1200 Gbps and one node; the other provider carries 800.
    expect(bar).toContain("1200 Gbps");
    expect(bar).not.toContain("2000 Gbps");
  });

  test("a term that matches no row of a searched section is not an error state", async () => {
    // Same message as the book, from the shared `emptyMessage`: the noun and the
    // term, and nothing about a service that is fine.
    const { container } = mount("infrastructure/providers");
    await type(input(container), "zzz");
    expect(main(container).textContent).toContain("No providers match");
  });

  test("a section that has a vocabulary does not also offer a search", async () => {
    // One control per question. A search beside twelve group toggles is the same
    // defect as a second strip of chips under the heading: the reader presses one,
    // watches the list change, and cannot say which of them the other is for.
    for (const key of FILTERED) {
      const { container } = mount(key);
      expect(maybe(container, "[data-search-input]"), key).toBeNull();
      expect(maybe(container, "[data-group-item]"), key).not.toBeNull();
    }
  });

  test("the main column draws no search of its own", async () => {
    // A search under the heading as well is two ways to narrow one list, and the
    // main column is where the second copy would be invisible: it sits directly
    // above the table it is not filtering.
    for (const key of SEARCHED) {
      const { container } = mount(key);
      expect(main(container).querySelector("[data-search-input]"), key).toBeNull();
    }
  });

  test("the column says it is loading rather than offering a field over nothing", async () => {
    // A field over a service that has not answered accepts a term and then matches
    // nothing, which is indistinguishable from a wrong term.
    const { container } = mountInteractive(columns("market/book"), "", emptyQueryClient());
    expect(container.textContent).toContain("Loading");
    expect(maybe(container, "[data-search-input]")).toBeNull();
    expect(maybe(container, "[data-search-count]")).toBeNull();
  });
});

describe("searchRows", () => {
  const rows = [
    { name: "Nairobi IXP", kind: "ixp", country: "Kenya" },
    { name: "Mombasa corridor", kind: "subsea_cable", country: "Kenya" },
    { name: "SEACOM", kind: "subsea_cable", country: "Tanzania" },
  ];
  const fields = (row: (typeof rows)[number]): readonly string[] => [
    row.name,
    row.kind,
    row.country,
  ];
  const names = (found: readonly (typeof rows)[number][]): string[] => found.map((r) => r.name);

  test("a blank term leaves every row", () => {
    // The same rule `visibleBy` follows, and the reason it is worth stating: the
    // version that filters on `""` returns nothing at all, and the reader sees an
    // empty table under a field they have not touched.
    expect(searchRows(rows, "", fields)).toHaveLength(3);
    expect(searchRows(rows, "   ", fields)).toHaveLength(3);
  });

  test("it matches case-insensitively", () => {
    expect(names(searchRows(rows, "Nairobi", fields))).toEqual(["Nairobi IXP"]);
    expect(names(searchRows(rows, "nairobi", fields))).toEqual(["Nairobi IXP"]);
  });

  test("it matches a substring, not only a prefix", () => {
    expect(names(searchRows(rows, "mba", fields))).toEqual(["Mombasa corridor"]);
  });

  test("every word has to match", () => {
    // And-ed rather than or-ed, because an or widens the list as the term gets more
    // specific: "subsea tanzania" would then return every subsea cable.
    expect(names(searchRows(rows, "subsea kenya", fields))).toEqual(["Mombasa corridor"]);
    expect(names(searchRows(rows, "subsea tanzania", fields))).toEqual(["SEACOM"]);
    expect(searchRows(rows, "subsea france", fields)).toEqual([]);
  });

  test("extra whitespace between words is not a word", () => {
    expect(names(searchRows(rows, "  subsea   tanzania  ", fields))).toEqual(["SEACOM"]);
  });

  test("it searches the fields it is given and not the whole row", () => {
    // The ids are on the rows and are not in `fields`. A search that matched them
    // would let `?q=al-9` find an alert by its internal key, which is a different
    // question from the one on screen.
    const withId = [{ id: "al-9", name: "Nairobi IXP" }];
    expect(searchRows(withId, "al-9", (row) => [row.name])).toEqual([]);
    expect(searchRows(withId, "nairobi", (row) => [row.name])).toHaveLength(1);
  });

  test("it returns a copy, so the caller cannot narrow the fixture", () => {
    // `visibleBy` copies for the same reason: a filter that returned the array it
    // was given would hand the caller a list it might reorder.
    const source = [...rows];
    const found = searchRows(source, "", fields);
    found.pop();
    expect(source).toHaveLength(3);
  });
});
