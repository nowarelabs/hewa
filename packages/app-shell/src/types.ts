import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The shell's public contract.
 *
 * An app supplies a {@link ShellConfig} and gets back a title bar, a row of
 * view tabs, an icon rail, three collapsible panels, and a status bar. The app
 * decides *what* each of those shows; the package decides *where* they sit and
 * what they look like. Nothing here is admin-dashboard specific, and a view id
 * is an ordinary string rather than a union of literals, so an app can declare
 * as many views as it likes without editing this package.
 */

/** The two themes the shell ships. Selected with a `.dark` class on its root. */
export type ShellTheme = "light" | "dark";

/** An icon from `lucide-react`. Any component taking `className` and `size` works. */
export type ShellIcon = LucideIcon;

/** What a panel's content is told about where it is being rendered. */
export interface PanelProps {
  /** The view currently open in the shell. */
  view: string;
  /** The rail item selected within that view, or `null` when the view has none. */
  item: string | null;
  /** The theme the shell is currently painted in. */
  theme: ShellTheme;
}

/**
 * One of the three side columns, or the top strip above the main column.
 *
 * `render` is a component rather than an element so that the content can hold
 * state and run effects. A panel that is unmounted on switch must not keep a
 * poller alive, and an element created once by the config would be hoisted out
 * of the render cycle and do exactly that.
 */
export interface PanelSpec {
  /** Heading shown in the panel's own header bar. Omit to render no header. */
  title?: string;
  render: ComponentType<PanelProps>;
  /** Class applied to the panel body. Defaults to padding and vertical scroll. */
  bodyClassName?: string;
  /** `true` when the panel has nothing to show until something is selected. */
  empty?: boolean;
}

/** A button in the title bar or the status bar. */
export interface ShellAction {
  /** Stable identity for React keys. */
  id: string;
  /** Tooltip, mobile-menu text, and accessible name. */
  label: string;
  icon: ShellIcon;
  onSelect?: () => void;
  /**
   * Render the label next to the icon on wide viewports. Off by default, which
   * is the icon-only look most consoles use.
   */
  showLabel?: boolean;
  /**
   * Draw a rule before this action. Actions that belong to one visual cluster
   * share a group, and a change of group draws the separator.
   */
  group?: string;
  /** Renders the button disabled. */
  disabled?: boolean;
}

/** A label and value pair in the status bar's counter cluster. */
export interface ShellStat {
  id: string;
  label: string;
  value: string | number;
}

/** An item in the vertical icon rail, and the panel it opens in the left column. */
export interface RailItem {
  id: string;
  /** Tooltip and the collapsed left panel's heading. */
  label: string;
  icon: ShellIcon;
  /** The left column's content while this item is active. */
  panel: PanelSpec;
}

/** A zoom cluster in the status bar. Rendered only when `onZoomIn` or friends are given. */
export interface ShellZoom {
  /** Percentage, displayed verbatim. */
  value: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
}

/** The status bar's contents, all of them optional. */
export interface StatusSpec {
  /** Left cluster: the current view's message, then its actions. */
  message?: string;
  actions?: ShellAction[];
  /** Counters rendered after the actions. */
  stats?: ShellStat[];
  /** Right cluster: zoom, then a save stamp. */
  zoom?: ShellZoom;
  /** Text after the zoom cluster, e.g. `Last saved 14:02`. */
  savedAt?: string;
}

/**
 * A view: one tab in the title bar, one set of rail items, and the content of
 * all three panels plus the status bar. Declaring a view is the whole of an
 * app's navigation; the shell does the rest.
 */
export interface ViewSpec {
  /** Tab label. Keep it to one or two words, the tab strip is narrow. */
  label: string;
  /**
   * The name used where the label is too short to be unambiguous, which today
   * means the narrow-viewport menu. Defaults to `label`.
   */
  longLabel?: string;
  icon: ShellIcon;
  /** The rail. An empty array renders no rail. */
  rail: RailItem[];
  /** The middle column. */
  main: PanelSpec;
  /** The column right of centre, toggled by the panel button. */
  right: PanelSpec;
  /**
   * The outermost column. Omit to leave it out entirely rather than rendering
   * an always-empty one.
   */
  assistant?: PanelSpec;
  status?: StatusSpec;
}

/** The shell's identity, and the parts of the title bar that are not views. */
export interface BrandSpec {
  name: string;
  icon?: ShellIcon;
  /** Two-letter avatar in the corner. Omit to leave the corner empty. */
  initials?: string;
}

/** Everything the shell needs. */
export interface ShellConfig {
  brand: BrandSpec;
  /** The view open on first load, and after a reset. Must be a key of `views`. */
  defaultView: string;
  views: Record<string, ViewSpec>;
  /**
   * The view tab strip and the app's own buttons, in order. Everything the app
   * wants in the title bar that is not a view tab.
   */
  actions?: ShellAction[];
  theme?: ShellTheme;
  /**
   * Mirror the open view, the selected rail item, and the panel collapse state
   * into the URL query string. On by default, because a console link that
   * reopens on the panel you were looking at is worth the extra query. Requires
   * a `NuqsAdapter` above the shell; pass `false` to render without one.
   */
  syncUrl?: boolean;
}
