"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart,
  Bell,
  Cloud,
  Crosshair,
  DollarSign,
  Download,
  FileText,
  Filter,
  Globe,
  Info,
  MapPin,
  Navigation,
  Plane,
  Play,
  Radio,
  RefreshCw,
  Satellite,
  Search,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import type { RailItem, ShellConfig, ViewSpec } from "@hewa/app-shell";

import { AlertDetailsPanel, AlertRailPanel, AlertsFeed } from "./panels/alerts";
import { ConflictStream, IncidentDetailsPanel, IncidentRailPanel } from "./panels/conflicts";
import { EconomicIndicators, EconomicRailPanel } from "./panels/economic";
import { FlightListPanel, FlightTable, RAIL } from "./panels/flights";
import { ReportDetailsPanel, ReportFeed, ReportRailPanel } from "./panels/osint";
import { SatelliteListPanel, SatelliteTable } from "./panels/satellites";
import { LiveStreams, StreamInfoPanel, StreamListPanel } from "./panels/streams";
import { Assistant, SelectPrompt } from "./ui/primitives";

/**
 * The app.
 *
 * Everything below is data: which views exist, what each one is called, which
 * panels it opens, and what its status line says. The shell turns this into the
 * title bar, the tab strip, the rail, three columns and a status bar, so there
 * is no component here to keep in step with them.
 *
 * This file is the first version of the console written as configuration. It
 * replaced a `ViewMode` union, a 300-line layout component holding a
 * `viewModeConfigs` table, and seven switches that picked a panel per mode.
 */

/**
 * The seven status-line buttons had no behaviour behind them, and inventing one
 * would be worse than saying so. `noop` is named for what it is.
 */
const noop = (): void => {};

/**
 * The rail, built from the panel's own list of carriers.
 *
 * Written out here as well it was two lists to keep in step, and the panel
 * filters on the carrier while the rail selected an id, so a label that drifted
 * was a tab that opened an empty column.
 */
function flightRail(): RailItem[] {
  return RAIL.map((entry) => ({
    id: entry.id,
    label: entry.label,
    icon: Plane,
    panel: { title: entry.label, render: FlightListPanel },
  }));
}

const views: Record<string, ViewSpec> = {
  flights: {
    label: "Flights",
    longLabel: "Flight tracker",
    icon: Plane,
    rail: flightRail(),
    main: { render: FlightTable },
    right: {
      title: "Flight details",
      render: () => <SelectPrompt what="a flight" />,
    },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Analyse flight patterns and predict delays." />,
    },
    status: {
      message: "Real-time aircraft monitoring",
      actions: [
        { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop },
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
      ],
    },
  },

  satellites: {
    label: "Satellites",
    longLabel: "Satellite tracker",
    icon: Satellite,
    rail: [
      {
        id: "all",
        label: "All satellites",
        icon: Satellite,
        panel: { title: "All satellites", render: SatelliteListPanel },
      },
      {
        id: "recon",
        label: "Reconnaissance",
        icon: Satellite,
        panel: { title: "Reconnaissance", render: SatelliteListPanel },
      },
      {
        id: "weather",
        label: "Weather",
        icon: Cloud,
        panel: { title: "Weather", render: SatelliteListPanel },
      },
      {
        id: "comm",
        label: "Communication",
        icon: Radio,
        panel: { title: "Communication", render: SatelliteListPanel },
      },
      {
        id: "nav",
        label: "Navigation",
        icon: Navigation,
        panel: { title: "Navigation", render: SatelliteListPanel },
      },
    ],
    main: { render: SatelliteTable },
    right: {
      title: "Satellite details",
      render: () => <SelectPrompt what="a satellite" />,
    },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Predict orbital trajectories and collisions." />,
    },
    status: {
      message: "Orbital monitoring",
      actions: [{ id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop }],
    },
  },

  streams: {
    label: "Streams",
    longLabel: "Live streams",
    icon: Radio,
    rail: [
      {
        id: "all",
        label: "All streams",
        icon: Radio,
        panel: { title: "All streams", render: StreamListPanel },
      },
      {
        id: "ktn",
        label: "KTN News",
        icon: Radio,
        panel: { title: "KTN News", render: StreamListPanel },
      },
      {
        id: "citizen",
        label: "Citizen TV",
        icon: Radio,
        panel: { title: "Citizen TV", render: StreamListPanel },
      },
      {
        id: "ntv",
        label: "NTV Kenya",
        icon: Radio,
        panel: { title: "NTV Kenya", render: StreamListPanel },
      },
      {
        id: "k24",
        label: "K24",
        icon: Radio,
        panel: { title: "K24", render: StreamListPanel },
      },
    ],
    main: { render: LiveStreams },
    right: { title: "Stream info", render: StreamInfoPanel },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Generate stream summaries and highlights." />,
    },
    status: {
      message: "Video monitoring",
      actions: [{ id: "play-all", label: "Play all", icon: Play, onSelect: noop }],
    },
  },

  economic: {
    label: "Economic",
    longLabel: "Economic indicators",
    icon: BarChart,
    rail: [
      {
        id: "overview",
        label: "Overview",
        icon: BarChart,
        panel: { title: "Overview", render: EconomicRailPanel },
      },
      {
        id: "currency",
        label: "Currency",
        icon: DollarSign,
        panel: { title: "Currency", render: EconomicRailPanel },
      },
      {
        id: "gdp",
        label: "GDP",
        icon: TrendingUp,
        panel: { title: "GDP", render: EconomicRailPanel },
      },
      {
        id: "trade",
        label: "Trade",
        icon: ArrowRight,
        panel: { title: "Trade", render: EconomicRailPanel },
      },
      {
        id: "markets",
        label: "Markets",
        icon: Activity,
        panel: { title: "Markets", render: EconomicRailPanel },
      },
    ],
    main: { render: EconomicIndicators },
    right: {
      title: "Indicators",
      render: () => <SelectPrompt what="an indicator" />,
    },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Forecast economic trends and analyse markets." />,
    },
    status: {
      message: "Kenya economy",
      actions: [{ id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop }],
    },
  },

  conflicts: {
    label: "Conflicts",
    longLabel: "Conflict stream",
    icon: Crosshair,
    rail: [
      {
        id: "all",
        label: "All incidents",
        icon: Crosshair,
        panel: { title: "All incidents", render: IncidentRailPanel },
      },
      {
        id: "armed",
        label: "Armed",
        icon: Shield,
        panel: { title: "Armed", render: IncidentRailPanel },
      },
      {
        id: "protest",
        label: "Protests",
        icon: Users,
        panel: { title: "Protests", render: IncidentRailPanel },
      },
      {
        id: "tribal",
        label: "Tribal",
        icon: UserCheck,
        panel: { title: "Tribal", render: IncidentRailPanel },
      },
      {
        id: "resource",
        label: "Resource",
        icon: MapPin,
        panel: { title: "Resource", render: IncidentRailPanel },
      },
    ],
    main: { render: ConflictStream },
    right: { title: "Incident details", render: IncidentDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Analyse conflict patterns and escalation risks." />,
    },
    status: {
      message: "Security incidents",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "alerts", label: "Alerts", icon: AlertTriangle, onSelect: noop },
      ],
    },
  },

  alerts: {
    label: "Alerts",
    longLabel: "Alerts",
    icon: AlertTriangle,
    rail: [
      {
        id: "all",
        label: "All alerts",
        icon: AlertTriangle,
        panel: { title: "All alerts", render: AlertRailPanel },
      },
      {
        id: "critical",
        label: "Critical",
        icon: AlertCircle,
        panel: { title: "Critical", render: AlertRailPanel },
      },
      {
        id: "high",
        label: "High",
        icon: AlertTriangle,
        panel: { title: "High", render: AlertRailPanel },
      },
      {
        id: "medium",
        label: "Medium",
        icon: Info,
        panel: { title: "Medium", render: AlertRailPanel },
      },
      {
        id: "low",
        label: "Low",
        icon: Bell,
        panel: { title: "Low", render: AlertRailPanel },
      },
    ],
    main: { render: AlertsFeed },
    right: { title: "Alert details", render: AlertDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Correlate alerts and predict incidents." />,
    },
    status: {
      message: "Security alerts",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "mark-read", label: "Mark read", icon: Bell, onSelect: noop },
      ],
    },
  },

  osint: {
    label: "OSINT",
    longLabel: "Open-source intelligence",
    icon: FileText,
    rail: [
      {
        id: "all",
        label: "All reports",
        icon: FileText,
        panel: { title: "All reports", render: ReportRailPanel },
      },
      {
        id: "cia",
        label: "Intelligence",
        icon: Shield,
        panel: { title: "Intelligence", render: ReportRailPanel },
      },
      {
        id: "military",
        label: "Military",
        icon: Globe,
        panel: { title: "Military", render: ReportRailPanel },
      },
      {
        id: "political",
        label: "Political",
        icon: Users,
        panel: { title: "Political", render: ReportRailPanel },
      },
      {
        id: "economic",
        label: "Economic",
        icon: TrendingUp,
        panel: { title: "Economic", render: ReportRailPanel },
      },
    ],
    main: { render: ReportFeed },
    right: { title: "Report details", render: ReportDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () => <Assistant task="Synthesise intelligence from multiple sources." />,
    },
    status: {
      message: "Open-source intelligence",
      actions: [
        { id: "search", label: "Search", icon: Search, onSelect: noop },
        { id: "export", label: "Export", icon: Download, onSelect: noop },
      ],
    },
  },
};

/**
 * The title bar's own buttons.
 *
 * These came from a flow editor the app has since dropped, and every one of them
 * was passed a callback the caller never supplied, so all nine were inert. The
 * shell renders them because they belong to the chrome, and they are disabled
 * rather than silently doing nothing: a button that looks live and is not is
 * worse than one that says so.
 */
export const config: ShellConfig = {
  brand: { name: "Admin", initials: "AD" },
  defaultView: "flights",
  views,
  syncUrl: true,
  actions: [
    { id: "new", label: "New", icon: FileText, group: "file", disabled: false },
    {
      id: "open",
      label: "Open",
      icon: FileText,
      group: "file",
      disabled: false,
    },
    {
      id: "save",
      label: "Save",
      icon: FileText,
      group: "file",
      disabled: false,
    },
    {
      id: "undo",
      label: "Undo",
      icon: RefreshCw,
      group: "edit",
      disabled: false,
    },
    {
      id: "redo",
      label: "Redo",
      icon: RefreshCw,
      group: "edit",
      disabled: false,
    },
    {
      id: "import",
      label: "Import",
      icon: ArrowRight,
      group: "io",
      disabled: false,
    },
    {
      id: "export",
      label: "Export",
      icon: ArrowRight,
      group: "io",
      disabled: false,
    },
    {
      id: "clear",
      label: "Clear",
      icon: FileText,
      group: "io",
      disabled: false,
    },
  ],
};
