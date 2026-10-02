// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { Box } from "lucide-react";

import { AppShell } from "../src/AppShell";
import { WIDE_VIEWPORT } from "../src/layout";
import type { ShellConfig } from "../src/types";

/**
 * The side panels in both layouts, and which layout a given viewport gets.
 *
 * Everything worth checking here is about the change of layout rather than about
 * the panels themselves, and all of it is invisible to a test that only ever
 * mounts at 1024px. Four claims:
 *
 * - **A narrow panel is a sheet, not a narrower column.** 256px of panel beside a
 *   48px rail leaves about 70px of a 375px phone for the table it is filtering, so
 *   the same width that is unobtrusive on a desktop is unusable on a phone.
 * - **The column's default does not carry over.** `left` defaults *open* on a
 *   wide screen, because a filter nobody opens is a filter nobody uses. Applied to
 *   an overlay, that default is a sheet covering the content on arrival — so the
 *   narrow layout starts with nothing open.
 * - **A sheet is not in the URL.** `?left=1` is a fact about a window wide enough
 *   to have columns. Honouring it on a phone covers the table, and closing a sheet
 *   would write `left=0` into a link somebody was only reading. The mobile menu
 *   already works this way; these are the tests that hold the panels to it.
 * - **Crossing the breakpoint does not remount.** A panel with a typed-in value or
 *   a half-written search loses it to a remount on rotation, which is why the same
 *   `<aside>` is rendered in both layouts and only its classes change.
 *
 * `matchMedia` is stubbed rather than measured, because a real 1024px viewport
 * passes without saying anything about a 375px phone. The stub records the query
 * the shell asked for, which is how the breakpoint stays the one the title bar
 * splits on rather than a second number written down here.
 */

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
const queries: string[] = [];
const mediaListeners = new Set<() => void>();
type Listener = EventListenerOrEventListenerObject;
const openedFor: Listener[] = [];
const takenOff: Listener[] = [];
let listening = false;
let wide = true;

/**
 * The real functions, captured once at module load.
 *
 * Capturing them inside `beforeEach` would bind the *previous* test's spy — the
 * `window` property is never put back — so every test would nest its wrapper inside
 * the last. By the thirteenth test one listener added by the shell is recorded
 * thirteen times, and the assertion that exists to prove exactly one Escape handler
 * is added ends up measuring the test's own bookkeeping.
 */
const nativeAdd = window.addEventListener.bind(window) as (
  type: string,
  listener: Listener,
  options?: boolean | AddEventListenerOptions,
) => void;
const nativeRemove = window.removeEventListener.bind(window) as (
  type: string,
  listener: Listener,
  options?: boolean | EventListenerOptions,
) => void;

/**
 * A viewport the test decides.
 *
 * `matches` is a getter rather than a snapshot because the shell reads it inside a
 * layout effect on every mount, and a stub that froze its answer at construction
 * would report the width as it was before the test asked for a change.
 */
beforeEach(() => {
  wide = true;
  queries.length = 0;
  mediaListeners.clear();
  openedFor.length = 0;
  takenOff.length = 0;
  listening = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      queries.push(query);
      return {
        get matches() {
          return query === WIDE_VIEWPORT && wide;
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) =>
          mediaListeners.delete(listener),
      };
    },
  });
  // Tracked by identity rather than counted, because everything else in a rendering
  // tree adds keydown listeners of its own and a count says nothing about whether
  // *this* handler was the one taken off. The failure being guarded against is a
  // listener left behind: the next Escape press then reaches a handler for a sheet
  // that has already closed.
  window.addEventListener = (
    type: string,
    listener: Listener,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === "keydown" && listening) openedFor.push(listener);
    nativeAdd(type, listener, options);
  };
  window.removeEventListener = (
    type: string,
    listener: Listener,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type === "keydown") takenOff.push(listener);
    nativeRemove(type, listener, options);
  };
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    flush(() => root.unmount());
  }
  document.body.replaceChildren();
});

/**
 * `act` returns a thenable even for the synchronous form, which flushes before it
 * resolves. Nothing here waits on it: every assertion below is about the DOM as it
 * stands once the work is flushed.
 */
const flush = (work: () => void): void => {
  act(work);
};

/** Move to the other layout, as a resize would. */
const resize = (to: "wide" | "narrow"): void => {
  flush(() => {
    wide = to === "wide";
    for (const listener of mediaListeners) listener();
  });
};

/** A panel that remembers, so a remount is visible. */
function Recorder({ label }: { label: string }): ReactElement {
  const [count, setCount] = useState(0);
  return createElement(
    "div",
    { "data-recorder": label },
    createElement("span", null, `typed ${count}`),
    createElement("button", { type: "button", onClick: () => setCount(count + 1) }, "press"),
  );
}

const table = (what: string): ShellConfig["views"][string]["rail"][number]["main"] => ({
  title: what,
  render: () => createElement("div", null, `${what.toLowerCase()} table`),
});

const config: ShellConfig = {
  brand: { name: "Ops", icon: Box, initials: "OP" },
  defaultView: "network",
  syncUrl: true,
  views: {
    network: {
      label: "Network",
      icon: Box,
      rail: [
        {
          id: "nodes",
          label: "Nodes",
          icon: Box,
          section: "infrastructure/nodes",
          main: table("Nodes"),
          left: {
            title: "Kind",
            role: "filter",
            render: () => createElement(Recorder, { label: "left" }),
          },
          right: { title: "Node", render: () => createElement("div", null, "details") },
        },
        {
          id: "providers",
          label: "Providers",
          icon: Box,
          section: "infrastructure/providers",
          main: table("Providers"),
          // A second role on purpose: the panel beside the rail is a general
          // slot, so a destination with no vocabulary to narrow by answers with
          // a search over its rows rather than with nothing.
          left: {
            title: "Provider",
            role: "search",
            render: () => createElement(Recorder, { label: "providers-left" }),
          },
        },
      ],
      fallback: {
        main: table("Network"),
        left: { title: "Kind", role: "filter", render: () => createElement("div", null, "scope") },
      },
    },
  },
};

/**
 * A second view and a status line, for the tests about which bar carries what.
 *
 * Built here rather than added to {@link config}: the panel tests assert against
 * one view's rail, and giving them a second view to account for would be a change
 * to their fixture made for a different file's claim.
 */
const chromeConfig: ShellConfig = {
  ...config,
  actions: [{ id: "theme-elsewhere", label: "Fleet", icon: Box }],
  views: {
    network: {
      ...config.views.network,
      fallback: {
        ...config.views.network.fallback,
        status: {
          message: "Nodes and their headroom",
          actions: [{ id: "refresh", label: "Refresh", icon: Box }],
          stats: [{ id: "rows", label: "nodes", value: 4 }],
        },
      },
    },
    market: {
      label: "Market",
      icon: Box,
      rail: [
        {
          id: "book",
          label: "Book",
          icon: Box,
          section: "market/book",
          main: table("Book"),
          left: { title: "Pool", role: "search", render: () => createElement("div", null, "pool") },
        },
      ],
      fallback: {
        main: table("Market"),
        left: { title: "Pool", role: "search", render: () => createElement("div", null, "pool") },
      },
    },
  },
};

/**
 * Mount a shell whose panels are real.
 *
 * `hasMemory` makes the testing adapter behave like a browser one — the params it
 * was given are updated in place — because `left`, `right` and `assistant` are
 * written by the column layout, and an adapter that froze its initial value would
 * report every one of those writes as absent.
 */
const mount = (
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction,
  overrides: ShellConfig = config,
): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flush(() =>
    root.render(
      createElement(NuqsTestingAdapter, {
        hasMemory: true,
        searchParams,
        ...(onUrlUpdate === undefined ? {} : { onUrlUpdate }),
        children: createElement(AppShell, { config: overrides }),
      }),
    ),
  );
  return container;
};

/** Mount and open one panel, for the assertions about an open panel. */
const opened = (label: string, searchParams = ""): HTMLElement => {
  const container = mount(searchParams);
  press(button(container, label));
  return container;
};

const find = <T extends Element>(root: ParentNode, selector: string): T | null =>
  root.querySelector<T>(selector);

/** The open panel on a side. An `aside`, so a collapsed handle cannot be mistaken for one. */
const panel = (root: ParentNode, side = "left"): HTMLElement | null =>
  find(root, `aside[data-panel-side="${side}"]`);

/** The collapsed handle, which is the only way back once a panel is closed. */
const handle = (root: ParentNode, side = "left"): HTMLButtonElement | null =>
  find(root, `button[data-panel-side="${side}"]`);

const button = (root: ParentNode, title: string): HTMLButtonElement => {
  const found = find(root, `button[title="${title}"]`);
  if (found === null) throw new Error(`no button titled ${title}`);
  return found as HTMLButtonElement;
};

const press = (target: HTMLElement): void => {
  flush(() => {
    target.click();
  });
};

const rail = (root: ParentNode, label: string): HTMLButtonElement => {
  const found = find(root, `nav[aria-label="Sections in this view"] button[aria-label="${label}"]`);
  if (found === null) throw new Error(`no rail button called ${label}`);
  return found as HTMLButtonElement;
};

/** Let a batched URL write land. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const escape = (): void => {
  flush(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
};

describe("a viewport wide enough for columns", () => {
  test("the left panel is a column, open, on arrival", () => {
    const root = mount();
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("column");
    expect(panel(root)?.textContent).toContain("typed 0");
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("it shares the width rather than floating over the table", () => {
    // The distinction is the width: `w-64 shrink-0` is in the flow, `absolute` is
    // not. A sheet on a desktop is a modal over content nobody can reach.
    const className = panel(mount())?.className ?? "";
    expect(className).toContain("w-64");
    expect(className).not.toContain("absolute");
  });

  test("there is no scrim, because nothing is covering anything", () => {
    expect(find(mount(), "[data-shell-scrim]")).toBeNull();
  });

  test("the toggle is named for what the panel holds, not for where it sits", () => {
    // `role: "filter"` on the spec. "Toggle filters" says what the press will
    // find; "Toggle left panel" only says where to look.
    const root = mount();
    expect(button(root, "Toggle filters").getAttribute("aria-pressed")).toBe("true");
  });

  test("a panel with no role falls back to its side's wording", () => {
    // The shell has no other way to write a label, so a spec that declares
    // neither a role nor a title gets the geometry it has.
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    flush(() =>
      root.render(
        createElement(NuqsTestingAdapter, {
          hasMemory: true,
          searchParams: "",
          children: createElement(AppShell, {
            config: {
              ...config,
              views: {
                network: {
                  ...config.views.network,
                  rail: config.views.network.rail.map((item) =>
                    item.id === "nodes"
                      ? { ...item, left: { render: () => createElement("div", null, "bare") } }
                      : item,
                  ),
                },
              },
            },
          }),
        }),
      ),
    );
    expect(button(container, "Toggle left panel")).not.toBeNull();
  });

  test("pressing the toggle collapses to a handle, and the handle brings it back", () => {
    const root = mount();
    press(button(root, "Toggle filters"));
    expect(panel(root)).toBeNull();
    expect(handle(root)).not.toBeNull();
    press(handle(root) as HTMLButtonElement);
    expect(panel(root)).not.toBeNull();
  });
});

describe("a viewport with room for one of these", () => {
  beforeEach(() => {
    wide = false;
  });

  test("nothing is open on arrival, so nothing covers the table", () => {
    const root = mount();
    expect(panel(root)).toBeNull();
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("a link naming the panel open does not open it here", () => {
    // `?left=1` describes a window wide enough to have columns. Honouring it on a
    // phone opens a sheet over the content the sheet is for.
    expect(panel(mount("?left=1"))).toBeNull();
  });

  test("the toggle opens it as a sheet, and says which it will do", () => {
    // "Show", not "Toggle": the same button over an overlay reads as the verb
    // for what the press is about to do.
    const root = mount();
    const toggle = button(root, "Show filters");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    press(toggle);
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("sheet");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(find(root, "[data-shell-scrim]")).not.toBeNull();
  });

  test("the sheet floats over the main column rather than squeezing it", () => {
    const className = panel(opened("Show filters"))?.className ?? "";
    expect(className).toContain("absolute");
    expect(className).toContain("max-w-[85vw]");
    expect(className).not.toContain("shrink-0");
  });

  test("the scrim closes it", () => {
    // A screen with no Escape key and a pointer that cannot reach under a sheet
    // needs one gesture for dismissal, and it has to be reachable by keyboard too.
    const root = opened("Show filters");
    press(find(root, "[data-shell-scrim]") as HTMLElement);
    expect(panel(root)).toBeNull();
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("Escape closes it", () => {
    const root = opened("Show filters");
    escape();
    expect(panel(root)).toBeNull();
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("the Escape listener goes when the sheet does", () => {
    const root = mount();
    listening = true;
    press(button(root, "Show filters"));
    listening = false;
    // Exactly one, and it is a handler added while the sheet was opening.
    expect(openedFor).toHaveLength(1);

    escape();
    expect(takenOff).toContain(openedFor[0]);

    // A handler left attached is one that fires on the next Escape, with no sheet
    // open and nothing to close.
    const before = takenOff.length;
    escape();
    expect(takenOff).toHaveLength(before);
    expect(panel(root)).toBeNull();
    expect(root.textContent).toContain("nodes table");
  });

  test("leaving the destination closes it, because the sheet was for that destination", () => {
    // A filter that narrowed the nodes list stays open over the providers table if
    // it survives the navigation, and it narrows nothing there.
    const root = opened("Show filters");
    press(rail(root, "Providers"));
    expect(panel(root)).toBeNull();
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("opening the other sheet closes this one, because the screen holds one", () => {
    const root = opened("Show filters");
    press(button(root, "Show right panel"));
    expect(panel(root, "left")).toBeNull();
    expect(panel(root, "right")).not.toBeNull();
  });

  test("only the column layout writes the panel flags", async () => {
    // `nuqs` batches a URL write behind a timer even in the testing adapter, so this
    // waits a tick before reading the spy. Asserting in the same tick would pass
    // whether or not the shell had written anything at all.
    // The control for this: the same press *does* write `left=0` on a wide screen,
    // so "nothing was written below the breakpoint" is not merely a spy that never
    // fired. The wide press is `await`ed because `nuqs` batches a rate-limited
    // write behind a promise, and asserting against it in the same tick would pass
    // whether or not the shell wrote anything at all.
    const written: string[] = [];
    const root = mount("", (event) => written.push(event.queryString));
    press(button(root, "Show filters"));
    await settle();
    expect(written.join(" ")).not.toContain("left");

    resize("wide");
    press(button(root, "Toggle filters"));
    await settle();
    expect(written.join(" ")).toContain("left=0");
  });
});

describe("crossing the breakpoint", () => {
  test("a panel holding state survives the crossing", () => {
    // The case the shared element exists for: this panel is not a filter. Shrinking
    // the window is a change of presentation — the panel stays open, as a sheet,
    // with what was typed into it still in it.
    const root = mount();
    press(find(root, "[data-recorder] button") as HTMLElement);
    expect(root.textContent).toContain("typed 1");

    resize("narrow");
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("sheet");
    expect(root.textContent).toContain("typed 1");

    resize("wide");
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("column");
    expect(root.textContent).toContain("typed 1");
  });

  test("growing the window shows the column rather than pinning the sheet open", () => {
    // The overlay is the sheet's business, so a window that grows past the
    // breakpoint drops it — and shows the column's own flags, which say the panel
    // was open before the resize and so is open now, as a column.
    resize("narrow");
    const root = opened("Show filters");
    resize("wide");
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("column");
    expect(find(root, "[data-shell-scrim]")).toBeNull();
  });

  test("a dismissal holds, and is not undone by a resize", () => {
    // The other half of `decided`. Dismissing a sheet is the reader's answer about
    // this screen, so coming back to it — through a resize or a destination change —
    // must not reopen what they closed. A sheet that reappears by itself is the
    // shell ignoring them, not a layout change.
    resize("narrow");
    const root = opened("Show filters");
    press(find(root, "[data-shell-scrim]") as HTMLElement);
    expect(panel(root)).toBeNull();

    resize("wide");
    // The column has its own flags, and `left` defaults open there, so a window that
    // grows shows the column the reader would have on a desktop. Only the sheet was
    // dismissed.
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("column");

    resize("narrow");
    expect(panel(root)).toBeNull();
    expect(handle(root)).toBeNull();
  });
});

describe("the collapsed handle", () => {
  test("a closed column keeps one, because it is the only way back", () => {
    const root = mount("?left=0");
    expect(panel(root)).toBeNull();
    const collapsed = handle(root);
    expect(collapsed).not.toBeNull();
    press(collapsed as HTMLButtonElement);
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("column");
  });

  test("a closed sheet leaves nothing at its edge", () => {
    // The title bar's toggle opens it, and it is named after what the panel holds,
    // so a handle would be a second control for one panel — sitting in the one
    // place on a phone worth 24px of content. The claim is absence, and absence is
    // the thing a test has to be told to look for: an assertion that the handle is
    // `hidden` would pass just as well with a 24px strip still taking the width.
    const root = mount("?left=0");
    expect(handle(root)).not.toBeNull();

    resize("narrow");
    expect(panel(root)).toBeNull();
    expect(handle(root)).toBeNull();
    // And nothing else is standing in the gap: the main column's own inset is the
    // only thing between it and the edge of the screen.
    expect(find(root, "[data-panel-side]")).toBeNull();
  });

  test("and the toggle that replaced it is on the screen", () => {
    wide = false;
    const root = mount();
    const toggle = button(root, "Show filters");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.closest("[data-shell-title-bar]")).not.toBeNull();
  });
});

describe("the measurement itself", () => {
  test("asks about the same breakpoint the title bar splits on", () => {
    mount();
    expect(queries).toContain(WIDE_VIEWPORT);
    expect(WIDE_VIEWPORT).toBe("(min-width: 768px)");
  });

  test("every destination has a column, and a handle to bring it back", () => {
    // `left` is required on a rail item, so there is no destination the shell
    // renders one column narrower than the rest — the layout is the same at every
    // rail position, which is what makes the rail read as navigation rather than as
    // a set of similar screens that vary in width.
    for (const [section, title, noun] of [
      ["nodes", "Kind", "filters"],
      ["providers", "Provider", "search"],
    ]) {
      const root = mount(`?view=network&section.network=${section}&left=0`);
      expect(panel(root), section).toBeNull();
      // The handle is the panel's own heading, and the title-bar toggle is the
      // role: the handle sits on the panel it opens, so it can say its name, while
      // the button in the chrome has to describe what it does from across the room.
      expect(handle(root)?.getAttribute("title"), section).toBe(`Show ${title}`);

      const toggle = button(root, `Toggle ${noun}`);
      expect(toggle.getAttribute("aria-pressed"), section).toBe("false");
      press(toggle);
      expect(panel(root)?.getAttribute("data-panel-layout"), section).toBe("column");
    }
  });

  test("a destination whose panel is a search is named after it on a phone too", () => {
    // The role is what the toggle says, and it says the same thing in both
    // layouts: the panel does not change what it is for when it stops being a
    // column. The verb does change, because a press does something different to an
    // overlay than to a column beside the table.
    const root = mount("?view=network&section.network=providers");
    resize("narrow");

    // The column had it open, so the crossing leaves it open — as a sheet now.
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("sheet");
    expect(find(root, 'button[title="Show search"]')).not.toBeNull();

    // And the reader can dismiss it, after which the toggle is off.
    press(button(root, "Show search"));
    expect(panel(root)).toBeNull();
    expect(button(root, "Show search").getAttribute("aria-pressed")).toBe("false");
  });
});

/**
 * Which bar the tabs are in, and what the status bar gives up for them.
 *
 * The tabs are the one control that moves, and the claim worth holding down is the
 * pair of them together: a phone that lost the tabs altogether has no way back, and
 * a phone that kept them in the top bar has paid a whole row for them twice. So
 * this is about *which* bar, and about the controls that stayed where they were —
 * a bar that answered "where am I" by becoming a different bar is a second
 * responsive design to keep in step with the first.
 */
describe("where the view tabs are", () => {
  const titleBar = (root: ParentNode): HTMLElement | null => find(root, "[data-shell-title-bar]");
  const footer = (root: ParentNode): HTMLElement | null => find(root, "[data-shell-status]");
  /** The tab strip, in the bar named. Which bar is the claim, so it is a parameter. */
  const tabs = (within: ParentNode): HTMLElement | null => find(within, "[data-shell-view-tabs]");
  const tab = (root: ParentNode, label: string): HTMLButtonElement => {
    const found = find(root, `[role="tab"][title="${label}"]`);
    if (found === null) throw new Error(`no tab titled ${label}`);
    return found as HTMLButtonElement;
  };

  test("on a wide screen the tabs are in the title bar, and the footer is a status line", () => {
    const root = mount("", undefined, chromeConfig);
    expect(tabs(titleBar(root) as ParentNode)).not.toBeNull();
    expect(tabs(footer(root) as ParentNode)).toBeNull();
    expect(footer(root)?.getAttribute("data-shell-status-role")).toBe("status");
    expect(footer(root)?.textContent).toContain("Nodes and their headroom");
  });

  test("on a narrow screen they are in the status bar, and not in the title bar", () => {
    wide = false;
    const root = mount();
    expect(tabs(titleBar(root) as ParentNode)).toBeNull();
    expect(tabs(footer(root) as ParentNode)).not.toBeNull();
    expect(footer(root)?.getAttribute("data-shell-status-role")).toBe("nav");
  });

  test("and the title bar is still a title bar, not a second status bar", () => {
    // Only the tabs were asked to move. The toggles, the menu, the theme switch and
    // the account corner are the row a reader already knows, and a bar that gave
    // them up as well would be a different design rather than a narrower one.
    wide = false;
    const root = mount();
    expect(titleBar(root)).not.toBeNull();
    for (const label of ["Show filters", "Show right panel", "Menu", "Toggle theme"]) {
      expect(button(root, label)).not.toBeNull();
    }
    // The tabs are in the footer, not gone: this bar kept everything else.
    expect(find(titleBar(root) as ParentNode, "[role='tab']")).toBeNull();
    expect(find(footer(root) as ParentNode, "[role='tab']")).not.toBeNull();
  });

  test("both bars list the same views, in the same order, with the same one open", () => {
    // The claim is one component rather than two strips: a tab strip written twice
    // is one that has drifted, and the bar nobody was looking at is the wrong one.
    // So this compares what the two bars say, not how they are sized.
    const listed = (bar: ParentNode): string[] =>
      [...bar.querySelectorAll("[role='tab']")].map(
        (tab) => `${tab.getAttribute("title")}:${tab.getAttribute("aria-selected")}`,
      );
    const wideRoot = mount("", undefined, chromeConfig);
    expect(listed(titleBar(wideRoot) as ParentNode)).toEqual(["Network:true", "Market:false"]);

    resize("narrow");
    expect(listed(footer(wideRoot) as ParentNode)).toEqual(["Network:true", "Market:false"]);
  });

  test("the strip covers the bar it is in", () => {
    // This bar is nothing but navigation, so it is sized like one: every tab an
    // equal share of the width, and no gutter. Sized to their labels the tabs would
    // sit at the left and leave the rest of the row as dead space, and a bottom bar
    // with dead space in it reads as a bar with something missing. A little inset
    // is the one thing kept: flush to both edges, the strip looks stretched.
    wide = false;
    const root = mount("", undefined, chromeConfig);
    const bar = footer(root) as HTMLElement;
    expect(bar.children).toHaveLength(1);
    expect(bar.className).toContain("px-1.5");
    expect(bar.className).not.toContain("px-3");
    expect(tabs(bar)?.className).toContain("w-full");

    const buttons = [...bar.querySelectorAll("[role='tab']")];
    expect(buttons.length).toBeGreaterThan(1);
    // Widths are not observable in this DOM, so the claim is held as the mechanism
    // that produces them — the same way the sheet's placement is held.
    for (const button of buttons) {
      expect(button.className, button.getAttribute("title") ?? "").toContain("flex-1");
    }
  });

  test("the status bar's own clusters are hidden, not stacked under the navigation", () => {
    wide = false;
    const root = mount("", undefined, chromeConfig);
    // The clusters are *gone* rather than present and invisible: a status line
    // the reader cannot see is not one, and the counter it carried is the figure
    // the navigation cannot replace.
    expect(root.textContent).not.toContain("Nodes and their headroom");
    expect(root.textContent).not.toContain("4 nodes");
  });

  test("the tabs still change the view, from the bottom of the screen", () => {
    wide = false;
    const root = mount("", undefined, chromeConfig);
    expect(root.textContent).toContain("nodes table");
    press(tab(root, "Market"));
    expect(root.textContent).toContain("book table");
  });

  test("a sheet is still one press away, from the bar that was already there", () => {
    wide = false;
    const root = mount();
    press(button(root, "Show filters"));
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("sheet");
  });

  test("the status bar's own actions move into the menu rather than disappearing", () => {
    // The one way this change can quietly remove a control: the clusters are not
    // drawn, so an action that only ever existed in them has nowhere to be.
    wide = false;
    const root = mount("", undefined, chromeConfig);
    press(button(root, "Menu"));
    const menu = find(root, "[role='menu']");
    expect(menu?.textContent).toContain("Refresh");
    // The app's own actions are in the same group rather than in a second one.
    expect(menu?.textContent).toContain("Fleet");
  });

  test("crossing the line moves the bar without changing what is open", () => {
    const root = mount("", undefined, chromeConfig);
    press(find(root, "[data-recorder] button") as HTMLElement);
    expect(titleBar(root)).not.toBeNull();

    resize("narrow");
    expect(titleBar(root)).not.toBeNull();
    expect(tabs(footer(root) as ParentNode)).not.toBeNull();
    expect(tabs(titleBar(root) as ParentNode)).toBeNull();
    // The panel is still open, with what was typed into it still in it, and the
    // same section is still showing: a resize that moved the chrome and reset the
    // console would be a second, quieter bug.
    expect(panel(root)?.getAttribute("data-panel-layout")).toBe("sheet");
    expect(root.textContent).toContain("typed 1");
    expect(root.textContent).toContain("nodes table");

    resize("wide");
    expect(tabs(titleBar(root) as ParentNode)).not.toBeNull();
    expect(tabs(footer(root) as ParentNode)).toBeNull();
    expect(root.textContent).toContain("typed 1");
  });
});
