import { createElement, type ReactElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import { CONSOLE_SECTION_KEYS, type ConsoleSectionKey } from "@hewa/console-types";
import App from "../src/app/App";
import { config } from "../src/app/shell.config";
import { summaryCounts } from "../src/app/ui/primitives";
import { consoleFixtures } from "./fixtures";
import { emptyQueryClient, renderConsole } from "./harness";

/**
 * The strip between a main panel's heading and its contents, and which sections
 * have one.
 *
 * It states figures. It does not narrow anything: that moved to the column beside
 * the rail, and `tests/scope.test.ts` asserts the vocabulary there. What is asserted
 * here is the division itself — twelve sections draw their groups in the left column
 * and nothing under the heading, and the four with no vocabulary search there
 * instead — because a control that is right about the wrong thing is still wrong,
 * and a section that quietly grew a second set of chips would pass every other test
 * in this suite.
 *
 * Rendered with no query string, so every bar here is the one an operator sees on
 * arrival: the figures are there and nothing is in force.
 *
 * Two providers, both real ones. nuqs because the panels read their filter state
 * out of the URL and nuqs throws NUQS-404 rather than quietly falling back — so
 * without it the failures would be about a missing provider rather than a missing
 * bar. React Query because every panel reads its rows from a service: without a
 * seeded cache every panel would render in its pending state, and the assertions
 * below would pass or fail for the wrong reason.
 */
function section(key: ConsoleSectionKey): ReactElement {
  for (const spec of Object.values(config.views)) {
    const item = spec.rail.find((entry) => entry.section === key);
    if (item !== undefined) {
      return createElement(item.main.render);
    }
  }
  throw new Error(`no rail item for ${key}`);
}

const render = (key: ConsoleSectionKey): string => renderConsole(section(key));

/**
 * The four sections that search rather than narrow by group.
 *
 * Three market documents whose rows are a book, a series and a breakdown rather
 * than a list, and `infrastructure/providers`, which is already one row per
 * provider — a kind toggle in any of them would select the row it was built from.
 *
 * They keep their figures while their narrowing column went from empty to a search,
 * and that is the point of the two lists meeting here: the twelve sections that
 * publish a vocabulary must not grow a bar, because their column already says how
 * many rows are in force, and these four must keep theirs because a search says
 * which rows match rather than how many there are of anything.
 */
const FIGURE_SECTIONS = [
  "market/book",
  "market/prices",
  "market/venues",
  "infrastructure/providers",
] as const satisfies readonly ConsoleSectionKey[];

/** The twelve that publish a vocabulary, and so narrow by it. */
const SCOPED_SECTIONS = [
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

describe("the strip under the heading", () => {
  for (const key of FIGURE_SECTIONS) {
    test(`the ${key} main has one`, () => {
      expect(render(key)).toContain("data-summary-bar");
    });
  }

  for (const key of SCOPED_SECTIONS) {
    test(`the ${key} main has none`, () => {
      // The section's groups are in the left column. A second copy under the
      // heading is a count the filter has already changed and the reader has no
      // way to tell apart from the one the table is honouring.
      expect(render(key), key).not.toContain("data-summary-bar");
    });
  }

  test("there is a section per row in the fixture table, and no others", () => {
    // The loops above walk these two lists, so a section in neither would go
    // unasserted rather than fail. This is the pair that closes the gap: every
    // registered section is classified, and every fixture is registered.
    expect([...FIGURE_SECTIONS, ...SCOPED_SECTIONS].sort()).toEqual(
      [...CONSOLE_SECTION_KEYS].sort(),
    );
  });

  test("a strip holds figures and no controls", () => {
    // Asserted as the absence of any control at all, because that is what a strip
    // that grew a toggle again would look like: a figure beside a switch, and
    // nothing saying which of the two the count belongs to.
    for (const key of FIGURE_SECTIONS) {
      const html = render(key);
      expect(html, key).not.toContain("aria-pressed");
      expect(html, key).not.toContain("<button");
    }
  });

  test("a strip over data that has not arrived shows nothing rather than nothing at all", () => {
    // The strip stays and says `—` rather than going blank or saying `0`. A blank
    // strip is a figure that failed to render, and a zeroed one is a claim about
    // the world: `Best bid: 0` over a service that has not answered is the kind of
    // plausible lie an operator acts on. The dash is the one of the three that is
    // visibly missing.
    //
    // Asserted for the market documents because they are the sections whose strip
    // is figures rather than controls, and a zero there is a figure.
    for (const key of ["market/book", "market/prices"] as const) {
      const pending = renderConsole(section(key), emptyQueryClient());
      expect(pending, key).toContain("data-summary-bar");
      expect(pending, key).toContain("—");
      expect(pending, key).not.toMatch(/(?:>\s*(?:0|USD 0)\s*<)/);
      expect(pending, key).toContain("Loading ");
    }
  });
});

describe("which sections can have had a vocabulary at all", () => {
  /**
   * The payload half of the division, and only that.
   *
   * Which column a section draws is `tests/scope.test.ts` — all sixteen declare
   * one, twelve of them are a scope column and four are a search. What is left that
   * is *this* file's business is whether those four could have had group toggles:
   * they could not, because the vocabulary a toggle is built from is not in the
   * payload, and `meta.groups: never` is the compile-time half of the same fact.
   */
  test("their vocabularies are empty, and a toggle built from them would be a type error", () => {
    for (const key of FIGURE_SECTIONS) {
      expect(consoleFixtures[key].meta.groups, key).toEqual([]);
    }
  });

  test("the sections that draw toggles publish one, so the difference is the section's", () => {
    // Otherwise "the four have no vocabulary" would be a fact about the fixtures
    // rather than about the console, and a section could be moved into the wrong
    // list by editing a test file.
    //
    // `settlement/runs` is the exception this file cannot assert away: it draws two
    // toggles from groups it worked out of the rows, because no vocabulary is sent
    // for it. It is a toggling section with an empty payload vocabulary, which is
    // why it is listed here and not in `FIGURE_SECTIONS` — the four are the ones
    // with no group vocabulary *and* no toggles.
    for (const key of SCOPED_SECTIONS) {
      if (key === "settlement/runs") {
        expect(consoleFixtures[key].meta.groups, key).toEqual([]);
        continue;
      }
      expect(consoleFixtures[key].meta.groups.length, key).toBeGreaterThan(0);
    }
  });
});

describe("summaryCounts", () => {
  /**
   * Every item carries the key it was counted on, because a filter toggles on
   * that and not on the label: a section spells a kind `Payouts` on the rail and
   * `payout` in the query string, and a filter keyed on the label is a filter
   * keyed on a string someone has to keep in step with the display by hand.
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

  test("and it is not drawn on a phone", () => {
    // Asserted as the seam rather than as the result: this DOM has no viewport, so
    // "hidden" is not observable here — what is observable is that the bar hides
    // itself off the shell's own measurement, and that the root carries the two
    // things that measurement needs. A `hidden md:flex` of the bar's own would
    // render the same markup and be a third copy of 768px; a variant keyed off an
    // attribute the root does not carry hides nothing at all, and both fail here.
    const bar = render(FIGURE_SECTIONS[0]);
    expect(bar).toContain("group-data-[shell-layout=sheet]:hidden");

    const shell = renderConsole(createElement(App));
    expect(shell).toMatch(/class="[^"]*\bgroup\b[^"]*"/);
    expect(shell).toContain('data-shell-layout="column"');
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
