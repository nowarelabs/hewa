import { createElement, type ReactElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import {
  ALERT_SEVERITIES,
  CONSOLE_SECTION_KEYS,
  NODE_KINDS,
  SETTLEMENT_KINDS,
  type ConsoleSectionKey,
} from "@hewa/console-types";
import { SLA_STATES } from "@hewa/marketplace-types";
import { config } from "../src/app/shell.config";
import { summaryCounts } from "../src/app/ui/primitives";
import { consoleFixtures } from "./fixtures";
import { emptyQueryClient, renderConsole } from "./harness";

/**
 * Every section's main column carries a summary bar.
 *
 * The alerts section grew one by hand and the others had nothing, so the answer to
 * "what am I looking at" was the title and nothing else until you scrolled. A
 * section that forgets the bar is not broken, so nothing caught it; this asserts
 * it for all sixteen, which is the only reason every one of them will have one.
 *
 * Rendered with no query string, so every bar here is the one an operator sees on
 * arrival: the group counts are there and nothing is in force.
 *
 * Two providers, both real ones. nuqs because most of these panels read their
 * filter state out of the URL and nuqs throws NUQS-404 rather than quietly
 * falling back — so without it the failures would be about a missing provider
 * rather than a missing bar. React Query because every panel now reads its rows
 * from a service: without a seeded cache every bar would render in its pending
 * state, which has no chips in it, and the assertions below would pass or fail for
 * the wrong reason.
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

describe("summary bars", () => {
  for (const key of Object.keys(consoleFixtures) as unknown as ConsoleSectionKey[]) {
    test(`the ${key} main has one`, () => {
      expect(render(key)).toContain("data-summary-bar");
    });
  }

  test("there is a section per row in the fixture table, and no others", () => {
    // The loop above walks the fixtures, so a section with no fixture would go
    // unasserted rather than fail. This is the pair that closes the gap: every
    // registered section is here, and every fixture is registered.
    expect(Object.keys(consoleFixtures).sort()).toEqual([...CONSOLE_SECTION_KEYS].sort());
  });

  /**
   * The one bar that existed before this one, and the example the rest follow:
   * a count per group, labelled, in the section's own tints.
   *
   * Found by the group's own key rather than by the text of the chip, because the
   * chip is a button now and its label and its count are separate elements.
   *
   * All four alert sections group by severity, which is a decision the four of
   * them share and any one of them could quietly stop making. So all four are
   * asserted, not just `feed`.
   */
  const ALERT_SECTIONS = [
    "alerts/feed",
    "alerts/outages",
    "alerts/capacity",
    "alerts/security",
  ] as const satisfies readonly ConsoleSectionKey[];

  for (const key of ALERT_SECTIONS) {
    test(`the ${key} bar counts by severity`, () => {
      const html = render(key);
      for (const severity of ALERT_SEVERITIES) {
        expect(html).toContain(`data-summary-item="${severity}"`);
      }
    });
  }

  /**
   * The other filtering sections, against the vocabulary the service sends.
   *
   * Asserted rather than left to "the main has one": a bar that exists and counts
   * the wrong field is a bar that is right about nothing.
   */
  const NODE_SECTIONS = [
    "infrastructure/nodes",
    "infrastructure/headroom",
  ] as const satisfies readonly ConsoleSectionKey[];

  test("the infrastructure node bars count by kind", () => {
    // Both `nodes` and `headroom` are the same rows under the same vocabulary, and
    // they are two destinations rather than one list with a toggle. Either could
    // drop its bar without the other noticing.
    for (const key of NODE_SECTIONS) {
      const html = render(key);
      for (const kind of NODE_KINDS) {
        expect(html, `${key}/${kind}`).toContain(`data-summary-item="${kind}"`);
      }
    }
  });

  test("the settlement movement bar counts by kind", () => {
    const html = render("settlement/movements");
    for (const kind of SETTLEMENT_KINDS) {
      expect(html).toContain(`data-summary-item="${kind}"`);
    }
  });

  test("the payout bar counts by the transaction's own status", () => {
    // Not by settlement kind. A payout's `kind` says what the money was for; its
    // `status` says whether it happened. The bar is a triage control, so it counts
    // the field an operator filters on.
    const html = render("settlement/payouts");
    for (const status of consoleFixtures["settlement/payouts"].meta.groups) {
      expect(html, status).toContain(`data-summary-item="${status}"`);
    }
  });

  const SLA_SECTIONS = [
    "slas/commitments",
    "slas/at_risk",
    "slas/credits",
  ] as const satisfies readonly ConsoleSectionKey[];

  for (const key of SLA_SECTIONS) {
    test(`the ${key} bar counts by state`, () => {
      const html = render(key);
      for (const state of SLA_STATES) {
        expect(html).toContain(`data-summary-item="${state}"`);
      }
    });
  }

  /**
   * A chip with nothing behind it.
   *
   * The vocabulary comes from the service, and a vocabulary is larger than the
   * data in a way a hand-written list used to hide. Four fixtures carry a group
   * with no rows at all — `cdn_edge`, `escrow`, `at_risk`, `medium` — because
   * this is the state that used to be unrepresentable: the chips were counted out
   * of the rows, so a group with no rows had no chip, so pressing it later was
   * impossible and its absence was invisible.
   */
  test("a group with no rows still gets a chip", () => {
    expect(render("infrastructure/nodes")).toContain('data-summary-item="cdn_edge"');
    expect(render("settlement/movements")).toContain('data-summary-item="escrow"');
    expect(render("slas/commitments")).toContain('data-summary-item="at_risk"');
    expect(render("alerts/feed")).toContain('data-summary-item="medium"');
  });

  test("a chip with no rows reads zero", () => {
    // Label and count are separate elements on a filterable bar — the label is
    // the button, the count is a `tabular-nums` span beside it — so this reads
    // the chip's own markup rather than a joined string that only the
    // non-filtering bars would produce.
    expect(render("infrastructure/nodes")).toContain('CDN edge<span class="tabular-nums">0</span>');
    expect(render("settlement/movements")).toContain('Escrow<span class="tabular-nums">0</span>');
    // The SLA labels carry their noun, so `at_risk` on the commitments section
    // reads "At risk commitments" rather than a bare "At risk". Three sections
    // share that state and the operator has to know which one the chip is on
    // before they press it.
    expect(render("slas/commitments")).toContain(
      'At risk commitments<span class="tabular-nums">0</span>',
    );
    expect(render("alerts/feed")).toContain('Medium<span class="tabular-nums">0</span>');
  });

  test("a bar over data that has not arrived has no chips and is not broken", () => {
    // The pending state renders no bar at all rather than a bar of zeroes. A bar
    // that says "Critical: 0, High: 0" before anything has arrived is a claim
    // about the world, and it would be the first thing an operator saw.
    const pending = renderConsole(section("alerts/feed"), emptyQueryClient());
    expect(pending).not.toContain("data-summary-bar");
    expect(pending).toContain("Loading alerts");
  });
});

describe("which bars are filters", () => {
  /**
   * A bar is a filter where it is a breakdown of the rows below it, and only
   * there.
   *
   * This is the whole rule, and it is per section, so it is asserted for all
   * sixteen: nothing about a summary bar says what its rows are grouped by, so
   * there is no way to tell from reading the component whether a section that
   * should have been a filter was left as a summary.
   *
   * Four sections take no `filter`. Three are documents whose bar holds aggregates —
   * a book, a price series, a venue breakdown — and there is nothing for a chip to
   * select, so a toggle that hid half of one would be a control that lies.
   * `infrastructure/providers` is one row per provider, so a chip keyed on the
   * column it is keyed on would select the row it was built from.
   *
   * `settlement/runs` is here rather than in `SUMMARIES` despite having no
   * `meta.groups`, and the distinction is worth stating: a run has no status of its
   * own, so its vocabulary is the derived pair the panel names outright. Deriving
   * it from the rows instead is what the rule about vocabularies forbids — a run
   * currently holding no failed line would lose its "failed" chip, and a control
   * that appears and disappears with the data is a control that is only sometimes
   * there.
   */
  const FILTERS = [
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
  const SUMMARIES = [
    "market/book",
    "market/prices",
    "market/venues",
    "infrastructure/providers",
  ] as const satisfies readonly ConsoleSectionKey[];

  const ALL = [...FILTERS, ...SUMMARIES];

  for (const key of ALL) {
    const shouldFilter = (FILTERS as readonly string[]).includes(key);
    test(`the ${key} bar is a ${shouldFilter ? "filter" : "summary"}`, () => {
      expect(render(key).includes("data-filterable")).toBe(shouldFilter);
    });
  }

  test("every section is accounted for by the rule", () => {
    // Two lists, hand-written, and a section in neither has no stated reason to
    // be what it is. This is where a seventeenth section has to be classified.
    expect([...FILTERS, ...SUMMARIES].sort()).toEqual([...CONSOLE_SECTION_KEYS].sort());
  });

  test("a bar that is a filter has toggles in it", () => {
    // The other half of the rule, and the half a string cannot check: it looks for
    // a toggle *anywhere* in the main panel, so a section whose bar is a plain
    // summary but whose own layout holds `aria-pressed` buttons would pass on the
    // strength of them. `tests/filters.test.ts` looks inside the bar instead.
    for (const key of FILTERS) {
      expect(render(key), key).toContain('aria-pressed="false"');
    }
  });

  test("a bar that is not a filter holds no toggles", () => {
    for (const key of SUMMARIES) {
      expect(render(key), key).not.toContain("aria-pressed");
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
