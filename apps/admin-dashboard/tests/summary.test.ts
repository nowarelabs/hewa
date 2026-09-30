import { createElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import { config } from "../src/app/shell.config";
import { summaryCounts } from "../src/app/ui/primitives";
import { emptyQueryClient, renderConsole } from "./harness";

/**
 * Every main panel carries a summary bar.
 *
 * The alerts view grew one by hand and the other six had nothing, so the answer
 * to "what is this view showing" was the title and nothing else until you
 * scrolled. A view that forgets the bar is not broken, so nothing caught it;
 * this asserts it, which is the only reason the seventh view will have one.
 */
/**
 * Rendered with no query string, so every bar here is the one an operator sees
 * on arrival: the group counts are there and nothing is in force.
 *
 * Two providers, both of them real ones. nuqs because five of the seven panels
 * read their filter state out of the URL and nuqs throws NUQS-404 rather than
 * quietly falling back — so without it the failures would be about a missing
 * provider rather than about a missing bar. React Query because every panel now
 * reads its rows from a service: without a seeded cache every bar would render in
 * its pending state, which has no chips in it, and the assertions below would
 * pass or fail for the wrong reason. The cache is seeded from `tests/fixtures.ts`
 * rather than from the service's records — see that file for why.
 */
const render = (key: string): string => {
  const view = config.views[key];
  if (view === undefined) {
    throw new Error(`no view called ${key}`);
  }
  return renderConsole(createElement(view.main.render));
};

describe("summary bars", () => {
  for (const key of Object.keys(config.views)) {
    test(`the ${key} main has one`, () => {
      expect(render(key)).toContain("data-summary-bar");
    });
  }

  /**
   * The one bar that existed before this one, and the example the rest follow:
   * a count per group, labelled, in the view's own tints.
   *
   * Found by the group's own key rather than by the text of the chip, because
   * the chip is a button now and its label and its count are separate elements.
   */
  test("the alerts bar counts by severity", () => {
    const html = render("alerts");
    for (const severity of ["critical", "high", "medium", "low"]) {
      expect(html).toContain(`data-summary-item="${severity}"`);
    }
  });

  /**
   * A chip with nothing behind it.
   *
   * The vocabulary now comes from the service, and a vocabulary is larger than
   * the data in a way a hand-written list used to hide. Two of the fixtures carry
   * a group with no rows at all — an `election` incident and a `scientific`
   * satellite — because this is the state that used to be unrepresentable: the
   * chips were counted out of the rows, so a group with no rows had no chip, so
   * pressing it later was impossible and its absence was invisible.
   */
  test("a group with no rows still gets a chip", () => {
    expect(render("conflicts")).toContain(`data-summary-item="election"`);
    expect(render("satellites")).toContain(`data-summary-item="scientific"`);
  });

  test("a chip with no rows reads zero", () => {
    // Label and count are separate elements on a filterable bar — the label is
    // the button, the count is a `tabular-nums` span beside it — so this reads
    // the chip's own markup rather than a joined string that only the
    // non-filtering bars would produce.
    expect(render("conflicts")).toContain('Election<span class="tabular-nums">0</span>');
    expect(render("satellites")).toContain('Scientific<span class="tabular-nums">0</span>');
  });

  /**
   * A carrier the rail does not offer.
   *
   * The flights rail has four entries and none of them is "Unknown", so a bar
   * built from the rail would count three flights and leave the third uncounted.
   * This is the assertion that the bar and the rail are allowed to be different
   * sizes, which they never were before.
   */
  test("a group the rail does not offer is still counted", () => {
    const html = render("flights");
    expect(html).toContain(`data-summary-item="Unknown"`);
    expect(html).toContain('Unknown<span class="tabular-nums">1</span>');
  });

  test("a bar over data that has not arrived has no chips and is not broken", () => {
    // The pending state renders no bar at all rather than a bar of zeroes. A bar
    // that says "Critical: 0, High: 0" before anything has arrived is a claim
    // about the world, and it would be the first thing an operator saw.
    const pending = renderConsole(
      createElement(config.views["alerts"]?.main.render as never),
      emptyQueryClient(),
    );
    expect(pending).not.toContain("data-summary-bar");
    expect(pending).toContain("Loading alerts");
  });
});

describe("which bars are filters", () => {
  /**
   * A bar is a filter where it is a breakdown of the rows below it, and only
   * there.
   *
   * This is the whole rule, and it is per view, so it is asserted once for all
   * seven: nothing about a summary bar says what its rows are grouped by, so
   * there is no way to tell from reading the component whether a view that
   * should have been a filter was left as a summary.
   */
  const FILTERS = ["alerts", "conflicts", "osint", "flights", "satellites", "streams"];
  const SUMMARIES = ["economic"];

  for (const key of Object.keys(config.views)) {
    const shouldFilter = FILTERS.includes(key);
    test(`the ${key} bar is a ${shouldFilter ? "filter" : "summary"}`, () => {
      const html = render(key);
      expect(html.includes("data-filterable")).toBe(shouldFilter);
    });
  }

  test("every view is accounted for by the rule", () => {
    // Two lists, hand-written, and a view that is in neither has no stated
    // reason to be what it is.
    expect([...FILTERS, ...SUMMARIES].sort()).toEqual(Object.keys(config.views).sort());
  });

  test("a bar that is a filter has toggles in it", () => {
    // The other half of the rule, and the half a string cannot check: it looks
    // for a toggle *anywhere* in the main panel, so a view whose bar is a plain
    // summary but whose own layout holds `aria-pressed` buttons would pass on the
    // strength of them. `tests/filters.test.ts` looks inside the bar instead.
    for (const key of FILTERS) {
      expect(render(key)).toContain('aria-pressed="false"');
    }
  });
});

describe("summaryCounts", () => {
  /**
   * Every item carries the key it was counted on, because a filter toggles on
   * that and not on the label: the osint view upper-cases its categories, and a
   * filter keyed on "CIA" is a filter keyed on a string someone has to keep in
   * step with the display by hand.
   */

  const rows = [
    { kind: "armed", n: 1 },
    { kind: "armed", n: 2 },
    { kind: "protest", n: 3 },
  ];

  test("counts each group in the order the rows give", () => {
    expect(summaryCounts(rows, (row) => row.kind)).toEqual([
      { key: "armed", label: "Armed", value: 2, tint: undefined },
      { key: "protest", label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("shows a known group that has no rows yet", () => {
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["armed", "tribal"] })).toEqual([
      { key: "armed", label: "Armed", value: 2, tint: undefined },
      { key: "tribal", label: "Tribal", value: 0, tint: undefined },
      { key: "protest", label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("counts a group the list of names forgot", () => {
    // This is the social-category case: two reports the rail has no entry for.
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["armed"] })).toEqual([
      { key: "armed", label: "Armed", value: 2, tint: undefined },
      { key: "protest", label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("labels and tints are the caller's", () => {
    expect(
      summaryCounts(rows, (row) => row.kind, {
        label: (kind) => kind.toUpperCase(),
        tint: (kind) => `tint-${kind}`,
      }),
    ).toEqual([
      { key: "armed", label: "ARMED", value: 2, tint: "tint-armed" },
      { key: "protest", label: "PROTEST", value: 1, tint: "tint-protest" },
    ]);
  });
});
