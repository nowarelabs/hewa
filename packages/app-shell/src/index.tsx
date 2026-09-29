"use client";

export { AppShell } from "./AppShell";
export { IconRail } from "./IconRail";
export { SidePanel } from "./SidePanel";
export { StatusBar } from "./StatusBar";
export { TitleBar } from "./TitleBar";
export { useShellState } from "./state";
export { hasAssistant, resolveItem, resolveView } from "./resolve";

export type {
  BrandSpec,
  PanelProps,
  PanelSpec,
  RailItem,
  ShellAction,
  ShellConfig,
  ShellIcon,
  ShellStat,
  ShellTheme,
  ShellZoom,
  StatusSpec,
  ViewSpec,
} from "./types";
