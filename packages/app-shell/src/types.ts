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
  /**
   * The selected destination's id, or `null` for a view with no rail.
   *
   * This is what the panel is being rendered *for*, so a panel keys its fetch on
   * it. It is an id rather than a component deliberately: the shell hands panels
   * the selected id and the app decides what that id means.
   */
  section: string | null;
  /** The theme the shell is currently painted in. */
  theme: ShellTheme;
}

/**
 * What a panel is *for*, which is what its controls are called.
 *
 * The shell knows a panel's side and nothing about its contents, so it names the
 * thing in the title bar's own words: "Toggle filters" rather than "Toggle left
 * panel". A control named after its own geometry tells the reader where to look
 * and not what they will find, and a slot that can hold a filter, a search, a
 * legend, a form and an ops console cannot be named after any one of them.
 *
 * It changes nothing else. The panel renders identically whatever it is called;
 * this is a label, and the honest reason it exists is that the shell has no other
 * way to write one.
 */
export type PanelRole = "filter" | "search" | "info" | "edit" | "ops";

/**
 * One of the three side columns, or the top strip above the main column.
 *
 * `render` is a component rather than an element so that the content can hold
 * state and run effects. A panel that is unmounted on switch must not keep a
 * poller alive, and an element created once by the config would be hoisted out of
 * the render cycle and do exactly that.
 */
export interface PanelSpec {
  /** Heading shown in the panel's own header bar. Omit to render no header. */
  title?: string;
  render: ComponentType<PanelProps>;
  /**
   * What this panel is for, used to name its toggle. Defaults to the side's own
   * wording, so omitting it is safe and reads "Left panel".
   */
  role?: PanelRole;
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

/**
 * An item in the vertical icon rail: one destination within a view.
 *
 * A rail button navigates. It is not a filter over the view's rows, it is a
 * different set of rows with a different question behind it, and it owns the
 * panels that answer it. `main`, `left` and `right` are therefore per-rail-item
 * rather than per-view: two items in the same view are as entitled to different
 * centre columns as two views are, which is the whole difference between a rail
 * that navigates and one that filters.
 *
 * Each item carries its own {@link ShellIcon}. An icon that is shared across
 * items tells the reader the buttons are variants of one thing, and here they
 * are not.
 */
export interface RailItem {
  id: string;
  /** Tooltip, accessible name, and the section's heading. */
  label: string;
  /** This destination's own icon. */
  icon: ShellIcon;
  /**
   * The stable key of what this item shows, which is what a panel fetches by.
   *
   * Distinct from {@link RailItem.id}, which is only unique within the view. The
   * console's ids are already globally unique (`market/book`), so the two happen
   * to agree there; they are not required to, and a panel is told `item`, not
   * `section`, precisely so the app is the only one that has to know.
   */
  section: string;
  /** The middle column while this item is active. */
  main: PanelSpec;
  /**
   * The column between the rail and the middle one, while this item is active.
   *
   * Required, and there is deliberately no "nothing to put here". Every
   * destination declares this column, because the shell's geometry is the same
   * everywhere and a rail button that opens a screen one column narrower than its
   * neighbours reads as a column that failed to load — an empty one does exactly
   * the same, which is why neither is offered. The absence is not a statement
   * about the destination; the statement is made by what the column says.
   *
   * It is the narrowest column, and the natural home for whatever belongs to a
   * destination without being the destination: the vocabulary its rows group by
   * (`"filter"`), a way to find one of them (`"search"`), what its rows mean
   * (`"info"`), the form that creates or edits one (`"edit"`), or the console of
   * operations against them (`"ops"`). A destination with no vocabulary to narrow
   * by answers with a search over the rows it lists, or with a panel that
   * explains them — not with nothing.
   *
   * Whatever it holds, it holds *only* that. A filter drawn under this
   * destination's own header as well gives it two sets of switches, and the
   * reader watches controls they have never pressed and concludes the list is
   * unfiltered.
   */
  left: PanelSpec;
  /** The column right of centre while this item is active. */
  right?: PanelSpec;
  /** The outermost column while this item is active. */
  assistant?: PanelSpec;
  /** The status bar while this item is active. */
  status?: StatusSpec;
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
 * A view: one tab in the title bar, and the rail of destinations it holds.
 *
 * The view no longer declares panels of its own. It used to, and that was what
 * made a rail a filter: with `main` and `right` living here, every rail item in
 * the view drew the same two columns and the rail could only swap which rows
 * were in them. A view is now the grouping of its destinations, and the
 * destination owns the content.
 *
 * A view with no rail is still supported, and renders `fallback`: which is what a
 * single-screen view declares rather than manufacturing a rail for the sake of
 * one button.
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
  /**
   * The view's defaults, and the whole content of a view that declares no rail.
   *
   * A rail item declares the columns it wants and inherits any it omits, which
   * is how several sections share one legend without repeating it. The `main`
   * column is required on a rail item and optional here because a rail item with
   * no main column would be a button that navigates nowhere.
   */
  fallback: ViewContent;
}

/** The columns and the status bar that a single destination renders. */
export interface ViewContent {
  main: PanelSpec;
  /**
   * The narrow column, beside the rail. See {@link RailItem.left} for what belongs
   * in it; it is required here for the same reason, because this is what a view
   * renders when it has no rail, and a rail-less view is still a destination.
   */
  left: PanelSpec;
  right?: PanelSpec;
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
