import { readdirSync } from "node:fs";
import { isValidElement } from "react";
import { describe, expect, test } from "vite-plus/test";
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
        main: view.main,
        right: view.right,
        assistant: view.assistant,
        ...Object.fromEntries(view.rail.map((item) => [item.id, item.panel])),
      };
      for (const [slot, panel] of Object.entries(panels)) {
        if (panel === undefined) {
          continue;
        }
        expect(typeof panel.render, `${key}.${slot} takes a component`).toBe("function");
        expect(isValidElement(panel.render), `${key}.${slot} is not a prebuilt element`).toBe(
          false,
        );
      }
    }
  });
});
