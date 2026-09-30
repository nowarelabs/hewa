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

/**
 * The item a new view should open on, for the shell to write back when the view
 * changes.
 *
 * Switching views keeps `item` in the query string, and rail ids are reused
 * across views — `all` is the first item in five of them — so the carried-over
 * id either silently selects a different view's item or names nothing at all.
 * The latter is the worse case: `resolveItem` falls back to the first item for
 * the panel, and if the rail compared against the raw id then the panel would
 * draw one item while no button was lit.
 */
export function defaultItemFor(rail: RailItem[], itemId: string | null): string | null {
  if (rail.length === 0) {
    return null;
  }
  return rail.some((entry) => entry.id === itemId) ? itemId : (rail[0]?.id ?? null);
}

/** Whether any view declares the outermost column, which is what earns it a toggle. */
export function hasAssistant(views: Record<string, ViewSpec>): boolean {
  return Object.values(views).some((view) => view.assistant !== undefined);
}
