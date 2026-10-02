import { readdirSync } from "node:fs";
import { isValidElement } from "react";
import { describe, expect, test } from "vite-plus/test";
import {
  CONSOLE_SECTION_KEYS,
  consoleSectionPath,
  parseSectionKey,
  type ConsoleSectionKey,
  type ConsoleViewKey,
} from "@hewa/console-types";
import { config } from "../src/app/shell.config";

/**
 * The view/module mapping is a contract, not a preference.
 *
 * A file in `panels/` is one view and is named after its key in the shell
 * config, so the two can be read against each other without a lookup. It was
 * not that way once: `conflicts` was served by `panels/incidents.tsx`,
 * `economic` by `panels/economy.tsx`, and `primitives` and `store` sat in
 * `panels/` next to seven views without being one. Nothing failed, which is
 * the problem — the list of files did not say what the app was made of.
 */
const modules = readdirSync(new URL("../src/app/panels/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

const keys = Object.keys(config.views).sort();

/**
 * Every rail item in the config, as `view/id`, which is how the URL spells it.
 *
 * `view` is annotated as a `ConsoleViewKey` rather than left as the `string` that
 * `Object.entries` yields, because the pair goes to `consoleSectionPath`, which is
 * generic in the view so that it only accepts a section id belonging to that view.
 * A plain `string` here would make that check unreachable from this file.
 */
const items = Object.entries(config.views).flatMap(([view, spec]) =>
  spec.rail.map((item) => ({ view: view as ConsoleViewKey, item })),
);

describe("views", () => {
  test("every view has exactly one module, named after its key", () => {
    expect(modules).toEqual(keys);
  });

  test("the default view exists", () => {
    expect(keys).toContain(config.defaultView);
  });

  test("a panel takes a component, not a rendered element", () => {
    for (const [key, view] of Object.entries(config.views)) {
      const panels = {
        fallback: view.fallback,
        ...Object.fromEntries(view.rail.map((item) => [item.id, item])),
      };
      for (const [slot, panel] of Object.entries(panels)) {
        for (const column of ["left", "main", "right", "assistant"] as const) {
          const spec = panel[column];
          if (spec === undefined) {
            continue;
          }
          expect(typeof spec.render, `${key}.${slot}.${column} takes a component`).toBe("function");
          expect(
            isValidElement(spec.render),
            `${key}.${slot}.${column} is not a prebuilt element`,
          ).toBe(false);
        }
      }
    }
  });
});

describe("the rail", () => {
  test("every section in the contract is a destination, and every destination is one", () => {
    // The two lists are the whole navigation, and neither may hold something the
    // other does not: a section in the contract with no rail button is a question
    // nobody can ask, and a rail button naming a section the service does not
    // serve is a button that opens a panel which can never load.
    expect(items.map(({ view, item }) => `${view}/${item.id}`).toSorted()).toEqual(
      [...CONSOLE_SECTION_KEYS].toSorted(),
    );
  });

  test("a section's key is the view it lives under and its own id", () => {
    for (const { view, item } of items) {
      expect(item.section, `${view}/${item.id}`).toBe(`${view}/${item.id}`);
    }
  });

  test("a section's key is in the contract, so the panel's fetch resolves", () => {
    for (const { item } of items) {
      expect(CONSOLE_SECTION_KEYS, item.section).toContain(item.section as ConsoleSectionKey);
    }
  });

  test("a section's endpoint is the one the contract names", () => {
    // The panel fetches by `section` and the route handler forwards by the pair
    // from the same path, so this is the assertion that the button a reader
    // presses and the address the service holds are the same address.
    for (const { view, item } of items) {
      const { view: sectionView } = parseSectionKey(item.section as ConsoleSectionKey);
      expect(sectionView, item.section).toBe(view);
      expect(consoleSectionPath(view, item.id as never), item.section).toBe(
        `/api/v1/${view}/${item.id}`,
      );
    }
  });

  test("two destinations never share an id within one view", () => {
    // `resolveItem` finds by id, so a duplicate is one button that cannot be
    // reached: the URL would open whichever came first.
    for (const [view, spec] of Object.entries(config.views)) {
      const ids = spec.rail.map((item) => item.id);
      expect(new Set(ids).size, view).toBe(ids.length);
    }
  });

  test("every destination carries its own icon", () => {
    // An icon shared across items says the buttons are variants of one thing, and
    // these are not: "at risk" and "commitments" are different questions.
    const byView = new Map<string, Set<unknown>>();
    for (const { view, item } of items) {
      const seen = byView.get(view) ?? new Set();
      seen.add(item.icon);
      byView.set(view, seen);
    }
    for (const view of keys) {
      expect(byView.get(view)?.size, `${view} shares icons between destinations`).toBeGreaterThan(
        1,
      );
    }
  });

  test("a fallback answers a view that has a rail, and is a component like the rest", () => {
    // `resolveContent` hands a rail item's missing columns the view's fallback, so
    // the fallback is on screen for every section that omits one. It is not a
    // spare: it is what half the sections render.
    for (const [view, spec] of Object.entries(config.views)) {
      expect(spec.fallback.main, view).toBeDefined();
      expect(typeof spec.fallback.main.render, view).toBe("function");
    }
  });
});
