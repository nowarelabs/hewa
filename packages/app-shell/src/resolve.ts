import type { RailItem, ShellConfig, ViewContent, ViewSpec } from "./types";

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

/**
 * The selected destination, or the first one.
 *
 * A rail always has something selected, which is the difference between
 * navigating and filtering: there is no state where the rail shows nothing and
 * the main column is empty, because "no selection" is not a state a reader can be
 * in. `resolveContent` exists because a stale id resolves to the first item
 * rather than to nothing.
 */
export function resolveItem(rail: RailItem[], itemId: string | null): RailItem | null {
  if (rail.length === 0) {
    return null;
  }
  const found = rail.find((entry) => entry.id === itemId);
  return found ?? rail[0] ?? null;
}

/**
 * The columns a view renders, given which rail item is selected.
 *
 * Per-field, and the rule is short enough to hold in one's head: **a rail item
 * declares what it wants, and the view supplies anything it leaves out.**
 *
 * Per-field rather than per-object, because a destination that declares a main
 * column and no right column is the common case — most sections have one column
 * of rows and nothing beside them — and swapping the whole object would hand it
 * whatever the view's fallback right column happened to be, which is a
 * destination rendering another view's panel. It is also what keeps the view's
 * shared chrome shareable: several sections can share one right-hand legend by
 * all of them omitting it.
 */
export function resolveContent(view: ViewSpec, item: RailItem | null): ViewContent {
  if (item === null) {
    return view.fallback;
  }
  return {
    main: item.main,
    right: item.right ?? view.fallback.right,
    assistant: item.assistant ?? view.fallback.assistant,
    status: item.status ?? view.fallback.status,
  };
}

/**
 * Whether any destination declares the outermost column, which is what earns it a
 * toggle.
 *
 * Both places are checked because they are both ways to get one: a view with no
 * rail renders its `fallback`, and a rail item can declare one of its own. A
 * button that opens nothing is the kind of thing nobody notices until a user
 * clicks it.
 */
export function hasAssistant(views: Record<string, ViewSpec>): boolean {
  return Object.values(views).some(
    (view) =>
      view.fallback.assistant !== undefined ||
      view.rail.some((item) => item.assistant !== undefined),
  );
}
