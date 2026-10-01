// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { AppShell } from "@hewa/app-shell";

import { config } from "../src/app/shell.config";
import { seededQueryClient } from "./harness";

/**
 * The rail, and the rail item each view remembers.
 *
 * The item is keyed by view in the query string. One `?item=` for the whole
 * shell cannot hold where you were in two views at once, so a tab you had put on
 * the third button reopened on the first: the view you visited in between had
 * overwritten the selection on the way out.
 *
 * The other half is that the lit button and the drawn panel are the same item.
 * A stale id resolves to the first rail item, and if the rail compared against
 * the raw id then the panel would draw one thing with nothing lit.
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
  // The shell draws real panels, and every panel now reads its rows from a
  // query. The client is seeded with the fixtures so the tree resolves without a
  // fetch — these tests are about which rail item is lit, and a request that
  // rejects mid-assert is a flake that has nothing to do with the rail.
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: seededQueryClient() },
        createElement(
          NuqsTestingAdapter,
          { hasMemory: true, searchParams } as never,
          createElement(AppShell as ReactElement extends never ? never : () => ReactElement, {
            config,
          }),
        ),
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

/** nuqs writes the query string on a microtask, so a press needs an await. */
const click = async (button: HTMLElement): Promise<void> => {
  await act(async () => {
    button.click();
  });
};

const chooseTab = (root: ParentNode, label: string): Promise<void> => click(tab(root, label));

const chooseRail = (root: ParentNode, label: string): Promise<void> => click(rail(root, label));

const rail = (root: ParentNode, label: string): HTMLButtonElement => {
  const found = root.querySelector<HTMLButtonElement>(
    `nav[aria-label="Sections"] button[aria-label="${label}"]`,
  );
  if (found === null) {
    throw new Error(`no rail button called ${label}`);
  }
  return found;
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
  test("presses the item the url names", () => {
    expect(pressed(mount("?view=alerts&item.alerts=high"))).toBe("High");
  });

  test("presses the first item for a url naming an item the view does not have", () => {
    // `ixp` is an infrastructure rail item. On alerts it resolves to `all`.
    expect(pressed(mount("?view=alerts&item.alerts=ixp"))).toBe(firstIn("alerts"));
  });

  test("presses the first item when the view has nothing selected", () => {
    expect(pressed(mount("?view=alerts"))).toBe(firstIn("alerts"));
  });

  test("keeps each view's rail item, so leaving and coming back restores it", async () => {
    // The bug: `?item=` was one key for every view, so a tab you had put on the
    // third button reopened on the first because the view you visited in between
    // had overwritten it.
    const container = mount("");
    await chooseTab(container, "Network");
    await chooseRail(container, "IXP");
    expect(pressed(container)).toBe("IXP");

    await chooseTab(container, "Alerts");
    expect(pressed(container)).toBe(firstIn("alerts"));

    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("IXP");
  });

  test("two views can hold two different rail items at once", async () => {
    const container = mount("");
    await chooseTab(container, "Network");
    await chooseRail(container, "IXP");
    await chooseTab(container, "Alerts");
    await chooseRail(container, "High");

    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("IXP");

    await chooseTab(container, "Alerts");
    expect(pressed(container)).toBe("High");
  });

  test("the url holds one key per view, so a link can reopen two of them", async () => {
    // Both selections in one link is the point of keying by view. With a single
    // `?item=` only one survives, so the link describes one view and not the other.
    const container = mount("?view=alerts&item.alerts=high&item.infrastructure=ixp");
    expect(pressed(container)).toBe("High");
    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("IXP");
  });
});
