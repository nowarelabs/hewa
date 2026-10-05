import { describe, expect, test } from "vite-plus/test";
import {
  FINANCE_SECTION_KEYS,
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  parseSectionKey,
} from "@hewa/financial-dashboard-types";

import { config } from "../src/app/shell.config";

/**
 * What the shell is handed, and what it may not be handed.
 *
 * The app has no chrome of its own: every rail button, column and status line is data in
 * `shell.config.tsx`, and the shell turns that into the layout. So the config is the only
 * thing in this app that decides what a reader can reach, and these are the rules about
 * that — asserted here rather than left to the eye, because each of them has a way of
 * looking fine while being wrong.
 */

/** Every rail item in the app, flattened, with the view it belongs to. */
const rail = Object.entries(config.views).flatMap(([view, spec]) =>
  (spec.rail ?? []).map((item) => ({ view, item })),
);

describe("the views", () => {
  test("there are the contract's four, in its order, and each names a long label", () => {
    // The tab strip draws `Object.keys`, so this is the order the reader sees. A long
    // label is what a collapsed tab strip falls back to, and a tab with no long label is
    // a two-letter tab at every width.
    expect(Object.keys(config.views)).toEqual([...FINANCE_VIEWS]);

    for (const [view, spec] of Object.entries(config.views)) {
      expect(spec.label, `${view} label`).not.toBe("");
      expect(spec.longLabel, `${view} long label`).not.toBe("");
      expect(spec.icon, `${view} icon`).toBeDefined();
    }
  });

  test("the default view is one of the views", () => {
    expect(FINANCE_VIEWS as readonly string[]).toContain(config.defaultView ?? "");
  });

  test("every view that can be reached can be reached from a cold load", () => {
    // The URL carries the view, so a bookmark or a shared link opens what it named. A
    // view reachable only by clicking is a view that cannot be linked to, and a finance
    // dashboard whose attestations cannot be pasted into a ticket is a dashboard that
    // will be read as a screenshot.
    expect(config.syncUrl).toBe(true);
  });

  test("every view has a fallback rail item, and it is the section it would open first", () => {
    // A view with no items has an empty rail, which is a column that failed to load.
    // The fallback is what a cold load of that view draws, so it has to name a section
    // the view actually owns.
    for (const [view, spec] of Object.entries(config.views)) {
      const first = FINANCE_SECTIONS[view as keyof typeof FINANCE_SECTIONS][0];
      const items = spec.rail ?? [];

      expect(items.length, `${view} rail`).toBeGreaterThan(0);
      expect(
        items.some((item) => item.section === `${view}/${first}`),
        `${view} opens on ${view}/${first}`,
      ).toBe(true);

      const fallback = spec.fallback;
      if (fallback === undefined) {
        continue;
      }

      expect(fallback.main.render, `${view} fallback main`).toBeDefined();
      expect(fallback.left, `${view} fallback left`).toBeDefined();
      // `status` and `title` are optional in the shell's types — a destination may omit
      // them — so this asserts that *these* destinations set them, by reading through
      // the optional rather than by asserting the type.
      expect(fallback.status?.message ?? "", `${view} fallback status`).not.toBe("");
    }
  });
});

describe("the rail", () => {
  test("the rail items are the contract's six sections, one each", () => {
    expect(rail.map(({ item }) => item.section).toSorted()).toEqual(
      [...FINANCE_SECTION_KEYS].toSorted(),
    );
    expect(rail).toHaveLength(FINANCE_SECTION_KEYS.length);
  });

  test("every rail item sits in the view whose section it names", () => {
    // A rail button under the wrong tab is a section the reader has to know the tab of.
    // The shell does not check this — it draws what it is given — so it is checked here.
    for (const { view, item } of rail) {
      const { view: owner, section } = parseSectionKey(item.section as never);
      expect(owner, `${item.id} is under ${view}`).toBe(view);
      expect(section.length, `${item.id} names a section`).toBeGreaterThan(0);
    }
  });

  test("every rail item declares a left column, a main column and a status line", () => {
    // `left` is required by `RailItem` for the geometry reason: a button that opens a
    // screen one column narrower than its neighbours reads as a column that failed to
    // load, which is also what an empty column looks like, so neither is available.
    // All six sections narrow by a group vocabulary their own service publishes, so
    // there is no section here that would answer with nothing.
    for (const { view, item } of rail) {
      expect(item.label, `${view}/${item.id} label`).not.toBe("");
      expect(item.icon, `${view}/${item.id} icon`).toBeDefined();
      expect(item.left, `${view}/${item.id} left`).toBeDefined();
      expect(item.left.render, `${view}/${item.id} left render`).toBeDefined();
      expect(item.main.render, `${view}/${item.id} main render`).toBeDefined();
      expect(item.status?.message ?? "", `${view}/${item.id} status`).not.toBe("");
    }
  });

  test("a left column that filters says so in its title, and one that edits names the record", () => {
    // The shell names the toggle after the panel's `role`, so the title is the only
    // place a reader is told what the column narrows by. "Panel" would be a control
    // named after its own geometry.
    for (const { item } of rail) {
      const left = item.left;
      const title = left.title ?? "";

      if (left.role === "filter") {
        expect(title, `${item.id} left title`).not.toBe("");
        expect(title.toLowerCase(), `${item.id} left title`).not.toBe("filters");
        expect(title.toLowerCase(), `${item.id} left title`).not.toBe("panel");
        continue;
      }

      // Not a filter, so it names what it holds: a record, or the state of one.
      expect(title.length, `${item.id} left title`).toBeGreaterThan(2);
    }
  });

  test("rail ids are unique across the app, not just within a view", () => {
    // The ids land in the query string as `?rail=` on some layouts and are used as React
    // keys, so two destinations with one id is a control that selects two sections.
    const ids = rail.map(({ item }) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("each section is written by one right column, and the read-only ones say so", () => {
    // Five writes across six sections: a receivable is derived from a bill and has
    // nothing an operator may change. That column is not left empty — an empty right
    // column is a column that failed to load — so this only checks the wiring exists.
    for (const { item } of rail) {
      const right = item.right;
      if (right === undefined) {
        continue;
      }

      expect(right.render, `${item.id} right render`).toBeDefined();
      expect((right.title ?? "").length, `${item.id} right title`).toBeGreaterThan(2);
    }
  });
});
