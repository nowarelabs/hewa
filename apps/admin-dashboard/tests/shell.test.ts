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

/**
 * The rail button the shell says you are at, or null when none is.
 *
 * `aria-current="page"` rather than `aria-pressed`, because these buttons
 * navigate and a toggle would claim "I am on". The assertion is about which one
 * the shell marks, so it reads the marker rather than the styling: a rail that
 * highlights the wrong button while marking the right one still sends the reader
 * to the wrong destination, and `tests/views.test.ts` is where the two are held
 * together.
 */
const pressed = (root: ParentNode): string | null => {
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>('nav[aria-label="Sections in this view"] button'),
  ];
  const active = buttons.filter((button) => button.getAttribute("aria-current") === "page");
  expect(active.length, `${active.length} rail buttons are current`).toBeLessThanOrEqual(1);
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
    `nav[aria-label="Sections in this view"] button[aria-label="${label}"]`,
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
  test("presses the section the url names", () => {
    // A rail button is a destination, so the URL names one. The key carries the
    // view and the value is the section's id within it, which is unambiguous
    // because two views may both have a `feed`.
    //
    // `security` rather than `feed` on purpose: the fallback for an id the rail
    // does not have is its first item, and `feed` *is* the first alert section,
    // so a URL of `feed` would pass whether the id resolved or not.
    expect(pressed(mount("?view=alerts&section.alerts=security"))).toBe("Security");
  });

  test("presses the first section for a url naming one the view does not have", () => {
    // `nodes` is a real section id, just not an alerts one. On alerts it resolves
    // to the first section rather than to nothing drawn.
    expect(pressed(mount("?view=alerts&section.alerts=nodes"))).toBe(firstIn("alerts"));
  });

  test("the section's own key does not resolve, because the key is view-scoped", () => {
    // `alerts/nodes` names a section that does not exist, and `section.alerts=nodes`
    // is what the shell writes. Writing the full key instead would resolve
    // against a rail whose ids are bare — it would fall back to the first item
    // every time and the link would describe a destination it never opens.
    expect(pressed(mount("?view=alerts&section.alerts=alerts/nodes"))).toBe(firstIn("alerts"));
  });

  test("presses the first section when the view has nothing selected", () => {
    expect(pressed(mount("?view=alerts"))).toBe(firstIn("alerts"));
  });

  test("keeps each view's section, so leaving and coming back restores it", async () => {
    // The bug: one `?section=` for the whole shell cannot hold where you were in
    // two views at once, so a tab you had put on the third button reopened on the
    // first because the view you visited in between had overwritten it.
    const container = mount("");
    await chooseTab(container, "Network");
    await chooseRail(container, "Headroom");
    expect(pressed(container)).toBe("Headroom");

    await chooseTab(container, "Alerts");
    expect(pressed(container)).toBe(firstIn("alerts"));

    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("Headroom");
  });

  test("two views can hold two different sections at once", async () => {
    const container = mount("");
    await chooseTab(container, "Network");
    await chooseRail(container, "Headroom");
    await chooseTab(container, "Alerts");
    await chooseRail(container, "Security");

    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("Headroom");

    await chooseTab(container, "Alerts");
    expect(pressed(container)).toBe("Security");
  });

  test("the url holds one key per view, so a link can reopen two of them", async () => {
    // Both selections in one link is the point of keying by view. With a single
    // `?section=` only one survives, so the link describes one view and not the
    // other.
    const container = mount("?view=alerts&section.alerts=security&section.infrastructure=headroom");
    expect(pressed(container)).toBe("Security");
    await chooseTab(container, "Network");
    expect(pressed(container)).toBe("Headroom");
  });

  /**
   * Two buttons on one rail that mean the same thing.
   *
   * Every rail item here is a *section*, so two of them cannot differ by which
   * rows they show — they differ by which rows and in what order, and they have
   * their own endpoints. A rail carrying `ixp` and `subsea_cable` looked like
   * navigation and filtered instead, and it is also the reason an operator
   * concluded "Subsea cable" was a place.
   */
  test("no rail item is named after a group of its view's rows", () => {
    for (const [view, spec] of Object.entries(config.views)) {
      const sectionIds = new Set(spec.rail.map((item) => item.id));
      expect(sectionIds.size, view).toBe(spec.rail.length);
      for (const item of spec.rail) {
        expect(item.section, `${view}/${item.id}`).toBe(`${view}/${item.id}`);
      }
    }
  });
});
