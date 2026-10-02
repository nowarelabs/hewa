"use client";

export { AppShell } from "./AppShell";
export { IconRail } from "./IconRail";
export { SidePanel } from "./SidePanel";
export { StatusBar } from "./StatusBar";
export { TitleBar } from "./TitleBar";
export { useShellState } from "./state";
export { hasAssistant, resolveContent, resolveItem, resolveView } from "./resolve";
export { WIDE_VIEWPORT, useShellLayout } from "./layout";

export type { PanelSide, SheetSide, ShellLayout } from "./layout";
export type {
  BrandSpec,
  PanelProps,
  PanelRole,
  PanelSpec,
  RailItem,
  ShellAction,
  ShellConfig,
  ShellIcon,
  ShellStat,
  ShellTheme,
  ShellZoom,
  StatusSpec,
  ViewContent,
  ViewSpec,
} from "./types";
