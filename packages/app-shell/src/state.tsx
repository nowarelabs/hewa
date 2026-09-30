import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryState } from "nuqs";

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
  item: string | null;
  selectItem: (item: string) => void;
  panels: {
    left: boolean;
    right: boolean;
    assistant: boolean;
  };
  togglePanel: (panel: "left" | "right" | "assistant") => void;
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
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [dark, setDark] = useState(defaultTheme === "dark");

  const value = useMemo<ShellState>(
    () => ({
      view,
      selectView: setView,
      item: items[view] ?? null,
      selectItem: (next) => setItems({ ...items, [view]: next }),
      panels: { left, right, assistant: hasAssistant && assistant },
      togglePanel: (panel) => {
        if (panel === "left") setLeft(!left);
        if (panel === "right") setRight(!right);
        if (panel === "assistant") setAssistant(!assistant);
      },
      theme: dark ? "dark" : "light",
      setTheme: (next) => {
        setDark(next === "dark");
        onThemeChange?.(next);
      },
    }),
    [view, items, left, right, assistant, dark, hasAssistant, onThemeChange],
  );

  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}

/**
 * State mirrored into the query string, so a link reopens what you were looking
 * at.
 *
 * The rail selection is keyed by view: `?item.flights=jambo`, `?item.alerts=high`.
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
  const [item, setItem] = useQueryState(`item.${openView}`, { defaultValue: EMPTY_ITEM });
  const [left, setLeft] = useQueryState("left", { defaultValue: "0" });
  const [right, setRight] = useQueryState("right", { defaultValue: "0" });
  const [assistant, setAssistant] = useQueryState("assistant", { defaultValue: "0" });
  const [dark, setDark] = useQueryState("dark", {
    defaultValue: encodeFlag(defaultTheme === "dark"),
  });

  const value = useMemo<ShellState>(
    () => ({
      view: openView,
      selectView: (next) => void setView(next),
      item: item === EMPTY_ITEM || item === null ? null : item,
      selectItem: (next) => void setItem(next === EMPTY_ITEM ? EMPTY_ITEM : next),
      panels: {
        left: decodeFlag(left, false),
        right: decodeFlag(right, false),
        assistant: hasAssistant && decodeFlag(assistant, false),
      },
      togglePanel: (panel) => {
        if (panel === "left") void setLeft(encodeFlag(!decodeFlag(left, false)));
        if (panel === "right") void setRight(encodeFlag(!decodeFlag(right, false)));
        if (panel === "assistant") {
          void setAssistant(encodeFlag(!decodeFlag(assistant, false)));
        }
      },
      theme: decodeFlag(dark, defaultTheme === "dark") ? "dark" : "light",
      setTheme: (next) => {
        void setDark(encodeFlag(next === "dark"));
        onThemeChange?.(next);
      },
    }),
    [
      openView,
      item,
      left,
      right,
      assistant,
      dark,
      defaultTheme,
      hasAssistant,
      setView,
      setItem,
      setLeft,
      setRight,
      setAssistant,
      setDark,
      onThemeChange,
    ],
  );

  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}
