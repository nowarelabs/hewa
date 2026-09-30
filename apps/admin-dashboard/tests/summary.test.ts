import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
const render = (key: string): string => {
  const view = config.views[key];
  if (view === undefined) {
    throw new Error(`no view called ${key}`);
  }
  return renderToStaticMarkup(createElement(view.main.render));
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
   */
  test("the alerts bar counts by severity", () => {
    const html = render("alerts");
    for (const severity of ["Critical", "High", "Medium", "Low"]) {
      expect(html).toContain(`${severity}: `);
    }
  });

  test("a bar survives data that has not arrived yet", () => {
    // The flights bar used to lose every chip but one while the worker was
    // loading, because the groups were counted out of an empty list.
    const html = render("flights");
    expect(html).toContain("Kenya Airways: ");
    expect(html).toContain("Safarilink: ");
  });
});

describe("summaryCounts", () => {
  const rows = [
    { kind: "armed", n: 1 },
    { kind: "armed", n: 2 },
    { kind: "protest", n: 3 },
  ];

  test("counts each group in the order the rows give", () => {
    expect(summaryCounts(rows, (row) => row.kind)).toEqual([
      { label: "Armed", value: 2, tint: undefined },
      { label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("shows a known group that has no rows yet", () => {
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["armed", "tribal"] })).toEqual([
      { label: "Armed", value: 2, tint: undefined },
      { label: "Tribal", value: 0, tint: undefined },
      { label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("counts a group the list of names forgot", () => {
    // This is the social-category case: two reports the rail has no entry for.
    expect(summaryCounts(rows, (row) => row.kind, { keys: ["armed"] })).toEqual([
      { label: "Armed", value: 2, tint: undefined },
      { label: "Protest", value: 1, tint: undefined },
    ]);
  });

  test("labels and tints are the caller's", () => {
    expect(
      summaryCounts(rows, (row) => row.kind, {
        label: (kind) => kind.toUpperCase(),
        tint: (kind) => `tint-${kind}`,
      }),
    ).toEqual([
      { label: "ARMED", value: 2, tint: "tint-armed" },
      { label: "PROTEST", value: 1, tint: "tint-protest" },
    ]);
  });
});
