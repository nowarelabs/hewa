import { describe, expect, test } from "vite-plus/test";
import type { ReactNode } from "react";
import { Circle } from "lucide-react";

import { defaultItemFor, hasAssistant, resolveItem, resolveView } from "../src/resolve";
import type { RailItem, ShellConfig, ViewSpec } from "../src/types";

/** These tests exercise resolution, so the panels render nothing at all. */
const noop = (): ReactNode => null;

function view(overrides: Partial<ViewSpec> = {}): ViewSpec {
  return {
    label: "View",
    icon: Circle,
    rail: [],
    main: { render: noop },
    right: { render: noop },
    ...overrides,
  };
}

function railItem(id: string): RailItem {
  return { id, label: id, icon: Circle, panel: { render: noop } };
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
  const rail = [railItem("all"), railItem("kenya")];

  test("returns the selected item", () => {
    expect(resolveItem(rail, "kenya")?.id).toBe("kenya");
  });

  test("falls back to the first item for an id the view no longer has", () => {
    expect(resolveItem(rail, "jambo")?.id).toBe("all");
  });

  test("falls back to the first item when nothing is selected yet", () => {
    expect(resolveItem(rail, null)?.id).toBe("all");
  });

  test("returns null for a view with no rail, so the shell renders no left panel", () => {
    expect(resolveItem([], "all")).toBeNull();
  });
});

describe("defaultItemFor", () => {
  const rail = [railItem("all"), railItem("kenya")];

  test("keeps an id the new view has", () => {
    expect(defaultItemFor(rail, "kenya")).toBe("kenya");
  });

  test("replaces an id the new view does not have, so the first rail item is selected", () => {
    // The bug: `?item=jambo` carried over from another view resolves to `all`
    // for the panel, so the left column drew "All flights" while no rail button
    // was lit — a view that looks like nothing is selected.
    expect(defaultItemFor(rail, "jambo")).toBe("all");
  });

  test("keeps a reused id, which is the same item in both views", () => {
    // `all` is the first rail item in five of the admin dashboard's views.
    expect(defaultItemFor(rail, "all")).toBe("all");
  });

  test("selects nothing for a view with no rail", () => {
    expect(defaultItemFor([], "all")).toBeNull();
  });
});

describe("hasAssistant", () => {
  test("is false when no view declares the outermost column", () => {
    expect(hasAssistant({ alpha: view() })).toBe(false);
  });

  test("is true when any view declares it", () => {
    expect(hasAssistant({ alpha: view(), beta: view({ assistant: { render: noop } }) })).toBe(true);
  });
});
