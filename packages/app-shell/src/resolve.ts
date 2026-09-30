import type { RailItem, ShellConfig, ViewSpec } from "./types";

/**
 * Resolution rules for the open view and the selected rail item.
 *
 * Both ids come from the query string, so both can be stale: a view can be
 * renamed, and a rail item can be removed while an old link is still in a
 * bookmark or a chat. Each falls back rather than rendering nothing, because a
 * shell with no tabs lit and an empty main column looks like a broken app
 * rather than an out-of-date link.
 *
 * The rail item is keyed by view in the query string, so `resolveItem` is only
 * reached with an id the current view shares no key with: a stale one, from a
 * rail entry that has since been renamed or removed.
 *
 * These are plain functions with no React in them, which is what makes them
 * testable without a DOM.
 */
export function resolveView(config: ShellConfig, viewId: string): ViewSpec {
  return config.views[viewId] ?? config.views[config.defaultView] ?? firstView(config);
}

function firstView(config: ShellConfig): ViewSpec {
  const [first] = Object.values(config.views);
  if (first === undefined) {
    throw new Error("A shell config must declare at least one view.");
  }
  return first;
}

export function resolveItem(rail: RailItem[], itemId: string | null): RailItem | null {
  if (rail.length === 0) {
    return null;
  }
  const found = rail.find((entry) => entry.id === itemId);
  return found ?? rail[0] ?? null;
}

/** Whether any view declares the outermost column, which is what earns it a toggle. */
export function hasAssistant(views: Record<string, ViewSpec>): boolean {
  return Object.values(views).some((view) => view.assistant !== undefined);
}
