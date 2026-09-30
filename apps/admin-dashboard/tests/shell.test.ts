// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { AppShell } from "@hewa/app-shell";

import { config } from "../src/app/shell.config";

/**
 * The rail, and the view switch that has to reset it.
 *
 * `?item=` is one key for every view, and the admin dashboard reuses `all` as
 * the first rail item in five of them, so switching views carries an id across
 * into a rail that may not have it. When it does not, the left column falls back
 * to the first item while the rail compared against the carried-over id and lit
 * nothing: a view with a panel open and no button pressed.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

const mount = (searchParams: string): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() =>
    root.render(
      createElement(
        NuqsTestingAdapter,
        { hasMemory: true, searchParams } as never,
        createElement(AppShell as ReactElement extends never ? never : () => ReactElement, {
          config,
        }),
      ),
    ),
  );
  return container;
};

/** The rail button currently pressed, or null when none is. */
const pressed = (root: ParentNode): string | null => {
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>('nav[aria-label="Sections"] button'),
  ];
  const active = buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
  expect(active.length, `${active.length} rail buttons are pressed`).toBeLessThanOrEqual(1);
  return active[0]?.getAttribute("aria-label") ?? null;
};

/** The first rail item's label in the given view, which is what it should fall back to. */
const firstIn = (view: string): string => {
  const rail = config.views[view]?.rail ?? [];
  const first = rail[0];
  if (first === undefined) {
    throw new Error(`view ${view} has no rail`);
  }
  return first.label;
};

const tab = (root: ParentNode, label: string): HTMLButtonElement => {
  const found = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === label,
  );
  if (found === undefined) {
    throw new Error(`no tab called ${label}`);
  }
  return found;
};

describe("the rail", () => {
  test("presses nothing when no view is asked for and the url has no item", () => {
    // Fresh load, no query string. Every view has a rail, so `all` is about to
    // become the selected item rather than "nothing is selected".
    expect(pressed(mount(""))).not.toBeNull();
  });

  test("presses the item the url names", () => {
    expect(pressed(mount("?view=alerts&item=high"))).toBe("High");
  });

  test("presses the first item for a url naming an item the view does not have", () => {
    // `safarilink` is a flights rail item. On alerts it resolves to `all`.
    expect(pressed(mount("?view=alerts&item=safarilink"))).toBe(firstIn("alerts"));
  });

  test("presses the first item after a switch carries an id the new view does not have", () => {
    const container = mount("?view=flights&item=safarilink");
    act(() => {
      tab(container, "Alerts").click();
    });
    expect(pressed(container)).toBe(firstIn("alerts"));
  });

  test("keeps a reused id selected across a switch, because it is the same item", () => {
    const container = mount("?view=flights&item=all");
    act(() => {
      tab(container, "Alerts").click();
    });
    expect(pressed(container)).toBe(firstIn("alerts"));
  });
});
