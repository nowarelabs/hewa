import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryState } from "nuqs";

import { useShellLayout, type PanelSide, type SheetSide, type ShellLayout } from "./layout";
import type { ShellTheme } from "./types";

/**
 * The shell's mutable state: which view is open, which rail item is selected,
 * which panels are expanded, and which theme is painted.
 *
 * This lives in a context rather than in the shell component for one reason.
 * Mirroring state into the URL needs `nuqs`, and `nuqs` needs a `NuqsAdapter`
 * above it. A hook cannot be called conditionally, so a shell that supported
 * both "with a provider" and "without one" in a single component would have to
 * call `useQueryState` unconditionally and swallow the throw. Splitting the
 * provider into its own component sidesteps that: `LocalShellState` never
 * touches `nuqs`, and `UrlShellState` always has the adapter its caller
 * promised. Each path calls its own hooks unconditionally.
 */
export interface ShellState {
  view: string;
  selectView: (view: string) => void;
  section: string | null;
  selectSection: (section: string) => void;
  /** Which layout the viewport gets. `"sheet"` below the shell's breakpoint. */
  layout: ShellLayout;
  /**
   * Whether each panel is on screen, which is not the same as whether its
   * collapse flag is set: on a narrow screen a panel is a sheet, and only the
   * sheet is on screen. A toggle reads this rather than the flag behind it, so
   * "shown" and "pressed" cannot come to disagree.
   */
  panels: Record<PanelSide, boolean>;
  /** Which sheet is open, or `null`. Always `null` in the column layout. */
  sheet: SheetSide;
  /** Opens, closes or flips a panel, by whichever mechanism the layout uses. */
  togglePanel: (panel: PanelSide) => void;
  /** Dismisses an open sheet. Nothing to do in the column layout. */
  closeSheet: () => void;
  theme: ShellTheme;
  setTheme: (theme: ShellTheme) => void;
}

const ShellStateContext = createContext<ShellState | null>(null);

export function useShellState(): ShellState {
  const state = useContext(ShellStateContext);
  if (state === null) {
    throw new Error("useShellState was called outside an AppShell. Render an <AppShell> first.");
  }
  return state;
}

const EMPTY_ITEM = "";

/** `1` and `0` rather than `true` and `false`, because a query string is text. */
function encodeFlag(value: boolean): string {
  return value ? "1" : "0";
}

function decodeFlag(value: string | null, fallback: boolean): boolean {
  if (value === "1") return true;
  if (value === "0") return false;
  return fallback;
}

interface ShellStateOptions {
  defaultView: string;
  defaultTheme: ShellTheme;
  hasAssistant: boolean;
  onThemeChange?: (theme: ShellTheme) => void;
}

interface InternalStateOptions extends ShellStateOptions {
  children: ReactNode;
}

/** Which three panel flags are on screen, and which sheet, as one stable object. */
interface PanelState {
  panels: Record<PanelSide, boolean>;
  sheet: SheetSide;
  toggle: (side: PanelSide) => void;
  close: () => void;
}

/** The panels, in the order a sheet layout resolves them. */
const SIDES: PanelSide[] = ["left", "right", "assistant"];

/**
 * The one open sheet, and whether it is the reader's doing.
 *
 * Two pieces of state rather than one boolean, because "no sheet" and "a sheet
 * nobody asked for" are different answers to the same question. The column layout's
 * flags say `left` is open — `left` defaults open, because a filter nobody opens is a
 * filter nobody uses — and a sheet layout cannot simply follow them on arrival: an
 * overlay covering the table is the opposite of a filter the reader can use. So a
 * phone arrives with nothing, and `decided` is what lets the two cases be told apart
 * afterwards:
 *
 * - `decided` is `false` on arrival, and the sheet is whatever the columns say *only
 *   once the reader has crossed the breakpoint* — see `useShellLayout`. A desktop
 *   window that shrinks has a panel the reader had open, and it stays open as a
 *   sheet with its state intact: a half-written search term, a form with something
 *   typed into it.
 * - `decided` is `true` from the first press of a toggle onwards, and then the
 *   reader's own answer is the whole truth. Opening one panel's sheet closes
 *   whichever was open, because a screen with room for one has no room for two, and
 *   dismissing one does not come back by itself.
 *
 * Everything here is memoised, and `close` in particular is more than an
 * optimisation: it is an effect dependency in `AppShell`, so a closure that captured
 * the flags would change identity whenever they did and re-run the effect that
 * navigations are supposed to trigger — closing the sheet the reader had just
 * opened.
 */
function usePanels(
  layout: ShellLayout,
  crossed: boolean,
  columns: Record<PanelSide, boolean>,
  flip: (side: PanelSide) => void,
): PanelState {
  const [opened, setOpened] = useState<SheetSide>(null);
  const [decided, setDecided] = useState(false);

  const close = useCallback(() => {
    setOpened(null);
    setDecided(true);
  }, []);

  /**
   * The sheet that is on screen, which is not always `opened`.
   *
   * Until the reader has decided something, a sheet is the column's own answer
   * carried across the breakpoint, and that answer lives in `columns` — so this is
   * derived before anything acts on it.
   */
  const sheet = useMemo<SheetSide>(() => {
    if (layout === "column") return null;
    if (decided) return opened;
    if (!crossed) return null;
    return SIDES.find((side) => columns[side]) ?? null;
  }, [layout, decided, opened, crossed, columns]);

  const toggle = useCallback(
    (side: PanelSide) => {
      if (layout === "column") {
        flip(side);
        return;
      }
      // Against `sheet`, not `opened`. A sheet the crossing left open was never in
      // `opened`, so comparing against it presses a sheet that is already up and
      // leaves it up, and the one control the reader has for it appears inert.
      setOpened(sheet === side ? null : side);
      setDecided(true);
    },
    [layout, flip, sheet],
  );

  const panels = useMemo<Record<PanelSide, boolean>>(() => {
    if (layout === "column") return columns;
    // Built from `sheet` rather than merged with the column's: a panel closed here
    // has to read as closed, or its toggle says "pressed" over content that is not
    // there.
    const onScreen: Record<PanelSide, boolean> = { left: false, right: false, assistant: false };
    if (sheet !== null) onScreen[sheet] = true;
    return onScreen;
  }, [layout, columns, sheet]);

  return useMemo<PanelState>(
    () => ({ panels, sheet, toggle, close }),
    [panels, sheet, toggle, close],
  );
}

export function ShellStateProvider(
  options: ShellStateOptions & { syncUrl: boolean; children: ReactNode },
): ReactNode {
  return options.syncUrl ? (
    <UrlShellState {...options}>{options.children}</UrlShellState>
  ) : (
    <LocalShellState {...options}>{options.children}</LocalShellState>
  );
}

/**
 * State held in `useState`, for a shell rendered without a `NuqsAdapter`.
 * Deep links do not survive a reload, which is the trade for a package that
 * does not force every consumer to install a provider.
 */
function LocalShellState({
  defaultView,
  defaultTheme,
  hasAssistant,
  onThemeChange,
  children,
}: InternalStateOptions): ReactNode {
  const [view, setView] = useState(defaultView);
  const [items, setItems] = useState<Record<string, string>>({});
  // Open by default, unlike the two right-hand columns. `left` holds what belongs
  // to a destination without being the destination — its narrowing first of all —
  // so arriving with it closed hides the answer to "what is this list narrowed by"
  // behind a click, and a control nobody opens is a control that gets used once
  // and then forgotten. This is the wide-screen default; a sheet gets its own.
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [dark, setDark] = useState(defaultTheme === "dark");
  const { layout, crossed } = useShellLayout();

  const columns = useMemo<Record<PanelSide, boolean>>(
    () => ({ left, right, assistant: hasAssistant && assistant }),
    [left, right, assistant, hasAssistant],
  );
  const flip = useCallback(
    (side: PanelSide) => {
      if (side === "left") setLeft(!left);
      if (side === "right") setRight(!right);
      if (side === "assistant") setAssistant(!assistant);
    },
    [left, right, assistant],
  );
  const panelState = usePanels(layout, crossed, columns, flip);

  const value = useMemo<ShellState>(
    () => ({
      view,
      selectView: setView,
      section: items[view] ?? null,
      selectSection: (next) => {
        setItems((prev) => ({ ...prev, [view]: next }));
      },
      layout,
      panels: panelState.panels,
      sheet: panelState.sheet,
      togglePanel: panelState.toggle,
      closeSheet: panelState.close,
      theme: dark ? "dark" : "light",
      setTheme: (next) => {
        setDark(next === "dark");
        onThemeChange?.(next);
      },
    }),
    [view, items, layout, panelState, dark, onThemeChange],
  );

  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}

/**
 * State mirrored into the query string, so a link reopens what you were looking
 * at.
 *
 * The rail selection is keyed by view: `?item.flights=book`, `?item.alerts=feed` (or new section key).
 * One `?item=` for the whole shell cannot hold where you were in two views at
 * once, so leaving a view either wrote its first item over the one you came
 * from — a tab you had put on the third button opening on the first — or carried
 * an id across into a rail that had never heard of it.
 */
function UrlShellState({
  defaultView,
  defaultTheme,
  hasAssistant,
  onThemeChange,
  children,
}: InternalStateOptions): ReactNode {
  const [view, setView] = useQueryState("view", { defaultValue: defaultView });
  const openView = view ?? defaultView;
  const [selected, setItem] = useQueryState(`section.${openView}`, { defaultValue: EMPTY_ITEM });
  const [left, setLeft] = useQueryState("left", { defaultValue: encodeFlag(true) });
  const [right, setRight] = useQueryState("right", { defaultValue: "0" });
  const [assistant, setAssistant] = useQueryState("assistant", { defaultValue: "0" });
  const [dark, setDark] = useQueryState("dark", {
    defaultValue: encodeFlag(defaultTheme === "dark"),
  });
  const { layout, crossed } = useShellLayout();

  const columns = useMemo<Record<PanelSide, boolean>>(
    () => ({
      left: decodeFlag(left, true),
      right: decodeFlag(right, false),
      assistant: hasAssistant && decodeFlag(assistant, false),
    }),
    [left, right, assistant, hasAssistant],
  );
  const flip = useCallback(
    (side: PanelSide) => {
      if (side === "left") void setLeft(encodeFlag(!columns.left));
      if (side === "right") void setRight(encodeFlag(!columns.right));
      if (side === "assistant") void setAssistant(encodeFlag(!columns.assistant));
    },
    [columns, setLeft, setRight, setAssistant],
  );
  const panelState = usePanels(layout, crossed, columns, flip);

  const value = useMemo<ShellState>(
    () => ({
      view: openView,
      selectView: (next) => void setView(next),
      section: selected === EMPTY_ITEM || selected === null ? null : selected,
      selectSection: (next) => void setItem(next === EMPTY_ITEM ? EMPTY_ITEM : next),
      layout,
      panels: panelState.panels,
      sheet: panelState.sheet,
      togglePanel: panelState.toggle,
      closeSheet: panelState.close,
      theme: decodeFlag(dark, defaultTheme === "dark") ? "dark" : "light",
      setTheme: (next) => {
        void setDark(encodeFlag(next === "dark"));
        onThemeChange?.(next);
      },
    }),
    [
      openView,
      selected,
      layout,
      panelState,
      dark,
      defaultTheme,
      setView,
      setItem,
      setDark,
      onThemeChange,
    ],
  );

  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}
