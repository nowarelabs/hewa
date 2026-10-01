import { createElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import { ALERT_SEVERITIES, NODE_KINDS, SETTLEMENT_KINDS } from "@hewa/console-types";
import { SLA_STATES } from "@hewa/marketplace-types";
import { config } from "../src/app/shell.config";
import { summaryCounts } from "../src/app/ui/primitives";
import { emptyQueryClient, renderConsole } from "./harness";

/**
 * Every main panel carries a summary bar.
 *
 * The alerts view grew one by hand and the others had nothing, so the answer to
 * "what is this view showing" was the title and nothing else until you scrolled.
 * A view that forgets the bar is not broken, so nothing caught it; this asserts
 * it, which is the only reason every view will have one.
 */
/**
 * Rendered with no query string, so every bar here is the one an operator sees
 * on arrival: the group counts are there and nothing is in force.
 *
 * Two providers, both of them real ones. nuqs because four of the five panels
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
    for (const severity of ALERT_SEVERITIES) {
      expect(html).toContain(`data-summary-item="${severity}"`);
    }
  });

  /**
   * The other three filtering bars, against the vocabulary the service sends.
   *
   * Asserted rather than left to "the main has one": a bar that exists and counts
   * the wrong field is a bar that is right about nothing.
   */
  test("the infrastructure bar counts by kind", () => {
    const html = render("infrastructure");
    for (const kind of NODE_KINDS) {
      expect(html).toContain(`data-summary-item="${kind}"`);
    }
  });

  test("the settlement bar counts by kind", () => {
    const html = render("settlement");
    for (const kind of SETTLEMENT_KINDS) {
      expect(html).toContain(`data-summary-item="${kind}"`);
    }
  });

  test("the SLAs bar counts by state", () => {
    const html = render("slas");
    for (const state of SLA_STATES) {
      expect(html).toContain(`data-summary-item="${state}"`);
    }
  });

  /**
   * A chip with nothing behind it.
   *
   * The vocabulary comes from the service, and a vocabulary is larger than the
   * data in a way a hand-written list used to hide. Each of the four fixtures
   * carries a group with no rows at all — `cdn_edge`, `escrow`, `at_risk`,
   * `medium` — because this is the state that used to be unrepresentable: the
   * chips were counted out of the rows, so a group with no rows had no chip, so
   * pressing it later was impossible and its absence was invisible.
   */
  test("a group with no rows still gets a chip", () => {
    expect(render("infrastructure")).toContain(`data-summary-item="cdn_edge"`);
    expect(render("settlement")).toContain(`data-summary-item="escrow"`);
    expect(render("slas")).toContain(`data-summary-item="at_risk"`);
    expect(render("alerts")).toContain(`data-summary-item="medium"`);
  });

  test("a chip with no rows reads zero", () => {
    // Label and count are separate elements on a filterable bar — the label is
    // the button, the count is a `tabular-nums` span beside it — so this reads
    // the chip's own markup rather than a joined string that only the
    // non-filtering bars would produce.
    expect(render("infrastructure")).toContain('CDN edge<span class="tabular-nums">0</span>');
    expect(render("settlement")).toContain('Escrow<span class="tabular-nums">0</span>');
    expect(render("slas")).toContain('At risk<span class="tabular-nums">0</span>');
    expect(render("alerts")).toContain('Medium<span class="tabular-nums">0</span>');
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
   * five: nothing about a summary bar says what its rows are grouped by, so there
   * is no way to tell from reading the component whether a view that should have
   * been a filter was left as a summary.
   *
   * `market` is the document. Its bar holds aggregates — best bid, committed
   * capacity — and there is nothing for a chip to filter, so it passes no
   * `filter` and a toggle that hid half the book would be a control that lies.
   */
  const FILTERS = ["alerts", "infrastructure", "settlement", "slas"];
  const SUMMARIES = ["market"];

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
   * that and not on the label: the settlement view spells a kind `Payouts` on the
   * rail and `payout` in the query string, and a filter keyed on the label is a
   * filter keyed on a string someone has to keep in step with the display by hand.
   */

  const rows = [
    { kind: "clearing", n: 1 },
    { kind: "clearing", n: 2 },
    { kind: "payout", n: 3 },
  ];

  test("counts each group in the order the rows give", () => {
    expect(summaryCounts(rows, (row) => row.kind)).toEqual([
      { key: "clearing", label: "Clearing", value: 2, tint: undefined },
      { key: "payout", label: "Payout", value: 1, tint: undefined },
    ]);
  });

  test("shows a known group that has no rows yet", () => {
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["clearing", "escrow"] })).toEqual([
      { key: "clearing", label: "Clearing", value: 2, tint: undefined },
      { key: "escrow", label: "Escrow", value: 0, tint: undefined },
      { key: "payout", label: "Payout", value: 1, tint: undefined },
    ]);
  });

  test("counts a group the list of names forgot", () => {
    // The case that matters: a group found in the rows and missing from the
    // vocabulary is counted rather than dropped.
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["clearing"] })).toEqual([
      { key: "clearing", label: "Clearing", value: 2, tint: undefined },
      { key: "payout", label: "Payout", value: 1, tint: undefined },
    ]);
  });

  test("labels and tints are the caller's", () => {
    expect(
      summaryCounts(rows, (row) => row.kind, {
        label: (kind) => kind.toUpperCase(),
        tint: (kind) => `tint-${kind}`,
      }),
    ).toEqual([
      { key: "clearing", label: "CLEARING", value: 2, tint: "tint-clearing" },
      { key: "payout", label: "PAYOUT", value: 1, tint: "tint-payout" },
    ]);
  });
});
