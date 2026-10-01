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
    fallback: { main: namedPanel("fallback-main") },
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
    const v = view({ rail, fallback: { main: namedPanel("f"), right: namedPanel("shared") } });
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
    const v = view({ rail, fallback: { main: namedPanel("f"), status: { message: "shared" } } });
    expect(resolveContent(v, resolveItem(rail, "book")).status?.message).toBe("shared");
  });

  test("the assistant column is inherited per-field like the rest", () => {
    const rail = [railItem("a", { assistant: namedPanel("a-asst") }), railItem("b")];
    const v = view({ rail, fallback: { main: namedPanel("f"), assistant: namedPanel("f-asst") } });
    expect(resolveContent(v, resolveItem(rail, "a")).assistant?.title).toBe("a-asst");
    expect(resolveContent(v, resolveItem(rail, "b")).assistant?.title).toBe("f-asst");
  });
});

describe("hasAssistant", () => {
  test("is false when nothing declares the outermost column", () => {
    expect(hasAssistant({ alpha: view() })).toBe(false);
  });

  test("is true when a view's fallback declares it", () => {
    expect(
      hasAssistant({
        alpha: view({ fallback: { main: namedPanel("m"), assistant: namedPanel("x") } }),
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
