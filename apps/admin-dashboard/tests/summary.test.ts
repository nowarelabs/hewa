import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, test } from "vite-plus/test";
import { config } from "../src/app/shell.config";
import { summaryCounts } from "../src/app/ui/primitives";

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
 * The adapter is nuqs' own testing one rather than a hand-rolled context. Five of
 * the seven panels now read their filter state out of the URL, and nuqs throws
 * NUQS-404 rather than quietly falling back when it cannot find one — so
 * without this the failures would be about a missing provider rather than about
 * a missing bar.
 */
const render = (key: string): string => {
  const view = config.views[key];
  if (view === undefined) {
    throw new Error(`no view called ${key}`);
  }
  return renderToStaticMarkup(
    createElement(NuqsTestingAdapter, null, createElement(view.main.render)),
  );
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
   * The morph, and the rule it is for.
   *
   * A summary bar is a strip of chips for a list that is grouped. Flights is
   * also a list looked up by callsign, and putting a text field in the same
   * strip gave the bar two jobs and no room for either — five toggles wrapping
   * onto a second line around a field that then had to shrink. So the bar is one
   * thing at a time: it is the summary, and asking turns it into the field.
   *
   * Only flights passes `search`, so the other six render no trigger at all.
   * Asserted here rather than left to reading the component, because a bar that
   * grew a search button it did not need is not a bug anyone would report.
   */
  test("the flights bar is a summary that can be asked to become the field", () => {
    const html = render("flights");
    expect(html).toContain("data-open-search");
    expect(html).not.toContain('role="searchbox"');
  });

  test("a link arriving searched arrives as the field", () => {
    // Not as the summary: a narrowed table under a bar of carrier counts is the
    // state that makes somebody type the query again because the console looks
    // like it forgot. `tests/filters.test.ts` drives this one through the DOM.
    const html = renderToStaticMarkup(
      createElement(
        NuqsTestingAdapter,
        { searchParams: "?flightsQ=KQ" } as never,
        createElement(config.views.flights?.main.render as never),
      ),
    );
    expect(html).toContain('role="searchbox"');
    expect(html).not.toContain("data-open-search");
  });

  test("no other bar grows a search trigger", () => {
    for (const key of Object.keys(config.views)) {
      if (key === "flights") {
        continue;
      }
      expect(render(key), key).not.toContain("data-open-search");
    }
  });

  test("a bar survives data that has not arrived yet", () => {
    // The flights bar used to lose every chip but one over an empty list,
    // because the groups were counted out of the rows rather than the table.
    const html = render("flights");
    expect(html).toContain(`data-summary-item="Kenya Airways"`);
    expect(html).toContain(`data-summary-item="Safarilink"`);
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
  const FILTERS = ["alerts", "conflicts", "osint", "flights", "satellites"];
  const SUMMARIES = ["streams", "economic"];

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
    // The other half of the rule, and the half a string cannot check: the streams
    // view has `aria-pressed` all over it, on the channel buttons, which have
    // nothing to do with its bar. `tests/filters.test.ts` looks inside the bar.
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
