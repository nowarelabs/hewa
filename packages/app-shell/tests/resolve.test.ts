import { describe, expect, test } from "vite-plus/test";
import type { ReactNode } from "react";
import { Circle } from "lucide-react";

import { hasAssistant, resolveContent, resolveItem, resolveView } from "../src/resolve";
import type { PanelSpec, RailItem, ShellConfig, ViewSpec } from "../src/types";

/** These tests exercise resolution, so the panels render nothing at all. */
const noop = (): ReactNode => null;

/**
 * A panel that announces which one it is, so an assertion can tell two columns
 * apart without inspecting element types.
 */
function namedPanel(name: string): PanelSpec {
  return { title: name, render: noop };
}

function view(overrides: Partial<ViewSpec> = {}): ViewSpec {
  return {
    label: "View",
    icon: Circle,
    rail: [],
    fallback: { main: namedPanel("fallback-main"), left: namedPanel("fallback-left") },
    ...overrides,
  };
}

function railItem(id: string, overrides: Partial<RailItem> = {}): RailItem {
  return {
    id,
    label: id,
    icon: Circle,
    section: id,
    main: namedPanel(`${id}-main`),
    left: namedPanel(`${id}-left`),
    ...overrides,
  };
}

function config(views: Record<string, ViewSpec>, defaultView: string): ShellConfig {
  return { brand: { name: "App" }, defaultView, views };
}

describe("resolveView", () => {
  test("returns the named view", () => {
    const views = { alpha: view({ label: "Alpha" }), beta: view({ label: "Beta" }) };
    expect(resolveView(config(views, "alpha"), "beta").label).toBe("Beta");
  });

  test("falls back to the default when the id names a view that no longer exists", () => {
    const views = { alpha: view({ label: "Alpha" }) };
    // A link to a view that has since been renamed must not render an empty shell.
    expect(resolveView(config(views, "alpha"), "flights").label).toBe("Alpha");
  });

  test("falls back to the default when the default itself is missing", () => {
    const views = { alpha: view({ label: "Alpha" }), beta: view({ label: "Beta" }) };
    expect(resolveView(config(views, "gone"), "gone").label).toBe("Alpha");
  });

  test("throws rather than rendering nothing when there are no views at all", () => {
    expect(() => resolveView(config({}, "missing"), "missing")).toThrow(/at least one view/);
  });
});

describe("resolveItem", () => {
  const rail = [railItem("book"), railItem("prices")];

  test("returns the selected item", () => {
    expect(resolveItem(rail, "prices")?.id).toBe("prices");
  });

  test("falls back to the first item for an id the rail no longer has", () => {
    // `?section.market=subsea` after a pool column became a destination with a
    // different id.
    expect(resolveItem(rail, "subsea")?.id).toBe("book");
  });

  test("falls back to the first item when nothing is selected yet", () => {
    expect(resolveItem(rail, null)?.id).toBe("book");
  });

  test("returns null for a view with no rail, so the shell renders no rail at all", () => {
    expect(resolveItem([], "book")).toBeNull();
  });

  test("a rail always resolves to something, so no destination draws another one's panels", () => {
    // The whole point of navigation over filtering: there is no "nothing selected"
    // state to render, so a stale id cannot leave the main column blank.
    for (const id of [null, "", "gone", "book", "prices"]) {
      expect(resolveItem(rail, id)).not.toBeNull();
    }
  });
});

describe("resolveContent", () => {
  test("a view with no rail renders its fallback", () => {
    const content = resolveContent(view(), null);
    expect(content.main.title).toBe("fallback-main");
  });

  test("a selected item owns the main column", () => {
    // Two items in one view draw two different centre columns. This is the
    // assertion that distinguishes a rail that navigates from one that filters,
    // and there is no way to write it against the old contract, where `main`
    // lived on the view.
    const rail = [railItem("book"), railItem("prices")];
    const v = view({ rail });
    expect(resolveContent(v, resolveItem(rail, "book")).main.title).toBe("book-main");
    expect(resolveContent(v, resolveItem(rail, "prices")).main.title).toBe("prices-main");
  });

  test("an item that declares no right column inherits the view's", () => {
    const rail = [railItem("book"), railItem("prices", { right: namedPanel("prices-right") })];
    const v = view({
      rail,
      fallback: { main: namedPanel("f"), left: namedPanel("f-left"), right: namedPanel("shared") },
    });
    expect(resolveContent(v, resolveItem(rail, "book")).right?.title).toBe("shared");
    expect(resolveContent(v, resolveItem(rail, "prices")).right?.title).toBe("prices-right");
  });

  test("an item that declares no right column and the view has none renders no column", () => {
    // Per-field inheritance must not manufacture a panel. An undefined column
    // means the shell renders nothing there, and a `null` would render an empty
    // box that reads as a failed fetch.
    const rail = [railItem("book")];
    expect(resolveContent(view({ rail }), resolveItem(rail, "book")).right).toBeUndefined();
  });

  test("two items in one view can each have their own status bar", () => {
    const rail = [
      railItem("book", { status: { message: "book" } }),
      railItem("prices", { status: { message: "prices" } }),
    ];
    const v = view({ rail });
    expect(resolveContent(v, resolveItem(rail, "book")).status?.message).toBe("book");
    expect(resolveContent(v, resolveItem(rail, "prices")).status?.message).toBe("prices");
  });

  test("an item inherits the view's status bar rather than losing it", () => {
    const rail = [railItem("book")];
    const v = view({
      rail,
      fallback: {
        main: namedPanel("f"),
        left: namedPanel("f-left"),
        status: { message: "shared" },
      },
    });
    expect(resolveContent(v, resolveItem(rail, "book")).status?.message).toBe("shared");
  });

  test("the assistant column is inherited per-field like the rest", () => {
    const rail = [railItem("a", { assistant: namedPanel("a-asst") }), railItem("b")];
    const v = view({
      rail,
      fallback: {
        main: namedPanel("f"),
        left: namedPanel("f-left"),
        assistant: namedPanel("f-asst"),
      },
    });
    expect(resolveContent(v, resolveItem(rail, "a")).assistant?.title).toBe("a-asst");
    expect(resolveContent(v, resolveItem(rail, "b")).assistant?.title).toBe("f-asst");
  });

  test("each item draws its own left column, and never the view's", () => {
    // The one column that is not inherited. Four alerts sections share one view
    // and one `meta.groups` axis, and a destination that inherited its
    // neighbour's narrowing would be filtering by a vocabulary it does not have:
    // the reader presses a chip that matches no row of theirs and cannot tell
    // whether the list is empty or the chip is wrong.
    const rail = [
      railItem("feed", { left: namedPanel("severity") }),
      railItem("providers", { left: namedPanel("provider") }),
    ];
    const v = view({ rail, fallback: { main: namedPanel("f"), left: namedPanel("shared") } });
    expect(resolveContent(v, resolveItem(rail, "feed")).left.title).toBe("severity");
    expect(resolveContent(v, resolveItem(rail, "providers")).left.title).toBe("provider");
  });

  test("every destination has a left column, including one that inherits nothing", () => {
    // `left` is required on `RailItem` and on `ViewContent`, so this is a
    // compile-time fact already. The runtime half is that the column is rendered
    // rather than skipped: a shell that rendered no column for a destination
    // would be narrower there than everywhere else, and the difference reads as a
    // column that failed to load rather than as a decision.
    const rail = [railItem("book"), railItem("prices")];
    const v = view({ rail });
    for (const id of ["book", "prices"]) {
      expect(resolveContent(v, resolveItem(rail, id)).left, id).toBeDefined();
    }
  });

  test("a view with no rail still has a left column", () => {
    // The other way to get here is a view that renders its `fallback`, so the
    // requirement has to hold on that path too or a rail-less view is the one
    // screen with nothing beside it.
    expect(resolveContent(view(), null).left.title).toBe("fallback-left");
  });
});

describe("hasAssistant", () => {
  test("is false when nothing declares the outermost column", () => {
    expect(hasAssistant({ alpha: view() })).toBe(false);
  });

  test("is true when a view's fallback declares it", () => {
    expect(
      hasAssistant({
        alpha: view({
          fallback: {
            main: namedPanel("m"),
            left: namedPanel("m-left"),
            assistant: namedPanel("x"),
          },
        }),
      }),
    ).toBe(true);
  });

  test("is true when a rail item declares it", () => {
    // The button has to exist, or a destination that owns an assistant column has
    // no way to open one.
    const rail = [railItem("a"), railItem("b", { assistant: namedPanel("asst") })];
    expect(hasAssistant({ alpha: view({ rail }) })).toBe(true);
  });
});
