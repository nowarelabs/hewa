import { ReactNode } from "react";
import { useQueryState } from "nuqs";

import {
  Search,
  Filter,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Download,
  ArrowRight,
  Play,
  FileText,
  MapPin,
  Plane,
  Satellite,
  Radio,
  Crosshair,
  Navigation,
  DollarSign,
  TrendingUp,
  Activity,
  Users,
  UserCheck,
  Bell,
  Globe,
  BarChart,
  Cloud,
  Shield,
} from "lucide-react";

import { TitleBar } from "./TitleBar";
import { NavigationIconsStrip, NavigationItem } from "./NavigationIconsStrip";
import { BottomBar, BottomBarAction } from "./BottomBar";
import { LeftPanelStrip, RightMostPanelStrip, RightPanelStrip } from "./PanelStrips";
import { LeftPanel } from "./leftpanel";
import { RightPanel } from "./rightpanel";
import { RightMostPanel } from "./rightmostpanel";

export type ViewMode =
  | "flights"
  | "satellites"
  | "streams"
  | "economic"
  | "conflicts"
  | "alerts"
  | "osint";

interface PanelConfig {
  label: string;
  content: string;
}

interface StatusBarConfig {
  message: string;
  actions: BottomBarAction[];
}

interface ViewModeConfig {
  navigation: NavigationItem[];
  rightPanel: PanelConfig;
  rightMostPanel: PanelConfig;
  statusBar: StatusBarConfig;
}

const viewModeConfigs: Record<ViewMode, ViewModeConfig> = {
  flights: {
    navigation: [
      { id: "all", icon: Plane, label: "All Flights" },
      { id: "kenya", icon: Plane, label: "Kenya Airways" },
      { id: "jambo", icon: Plane, label: "Jambojet" },
      { id: "fly540", icon: Plane, label: "Fly540" },
      { id: "safarilink", icon: Plane, label: "Safarilink" },
    ],
    rightPanel: {
      label: "Flight Details",
      content: "Selected flight information",
    },
    rightMostPanel: {
      label: "Airspace Stats",
      content: "Active flights and airspace status",
    },
    statusBar: {
      message: "Flight Tracker - Real-time aircraft monitoring",
      actions: [
        { icon: RefreshCw, label: "Refresh", onClick: () => {} },
        { icon: Filter, label: "Filter", onClick: () => {} },
      ],
    },
  },
  satellites: {
    navigation: [
      { id: "all", icon: Satellite, label: "All Satellites" },
      { id: "recon", icon: Satellite, label: "Reconnaissance" },
      { id: "weather", icon: Cloud, label: "Weather" },
      { id: "comm", icon: Radio, label: "Communication" },
      { id: "nav", icon: Navigation, label: "Navigation" },
    ],
    rightPanel: {
      label: "Satellite Details",
      content: "Selected satellite information",
    },
    rightMostPanel: {
      label: "Orbital Data",
      content: "Orbital parameters and trajectory",
    },
    statusBar: {
      message: "Satellite Tracker - Orbital monitoring",
      actions: [{ icon: RefreshCw, label: "Refresh", onClick: () => {} }],
    },
  },
  streams: {
    navigation: [
      { id: "all", icon: Radio, label: "All Streams" },
      { id: "ktn", icon: Radio, label: "KTN News" },
      { id: "citizen", icon: Radio, label: "Citizen TV" },
      { id: "bbc", icon: Radio, label: "BBC Africa" },
    ],
    rightPanel: { label: "Stream Info", content: "Current stream details" },
    rightMostPanel: { label: "Recent Clips", content: "Recent video clips" },
    statusBar: {
      message: "Live Streams - Video monitoring",
      actions: [{ icon: Play, label: "Play All", onClick: () => {} }],
    },
  },
  economic: {
    navigation: [
      { id: "overview", icon: BarChart, label: "Overview" },
      { id: "currency", icon: DollarSign, label: "Currency" },
      { id: "gdp", icon: TrendingUp, label: "GDP" },
      { id: "trade", icon: ArrowRight, label: "Trade" },
      { id: "markets", icon: Activity, label: "Markets" },
    ],
    rightPanel: { label: "Indicators", content: "Economic indicators" },
    rightMostPanel: { label: "Forecasts", content: "Economic forecasts" },
    statusBar: {
      message: "Economic Indicators - Kenya economy",
      actions: [{ icon: RefreshCw, label: "Refresh", onClick: () => {} }],
    },
  },
  conflicts: {
    navigation: [
      { id: "all", icon: Crosshair, label: "All Incidents" },
      { id: "armed", icon: Shield, label: "Armed" },
      { id: "protest", icon: Users, label: "Protests" },
      { id: "tribal", icon: UserCheck, label: "Tribal" },
      { id: "resource", icon: MapPin, label: "Resource" },
    ],
    rightPanel: {
      label: "Incident Details",
      content: "Selected incident information",
    },
    rightMostPanel: { label: "Intelligence", content: "Related intel reports" },
    statusBar: {
      message: "Conflict Stream - Security incidents",
      actions: [
        { icon: Filter, label: "Filter", onClick: () => {} },
        { icon: AlertTriangle, label: "Alerts", onClick: () => {} },
      ],
    },
  },
  alerts: {
    navigation: [
      { id: "all", icon: AlertTriangle, label: "All Alerts" },
      { id: "critical", icon: AlertCircle, label: "Critical" },
      { id: "high", icon: AlertTriangle, label: "High" },
      { id: "medium", icon: Info, label: "Medium" },
      { id: "low", icon: Bell, label: "Low" },
    ],
    rightPanel: {
      label: "Alert Details",
      content: "Selected alert information",
    },
    rightMostPanel: { label: "Alert Locations", content: "Alert locations" },
    statusBar: {
      message: "Alerts Panel - Security alerts",
      actions: [
        { icon: Filter, label: "Filter", onClick: () => {} },
        { icon: Bell, label: "Mark Read", onClick: () => {} },
      ],
    },
  },
  osint: {
    navigation: [
      { id: "all", icon: FileText, label: "All Reports" },
      { id: "cia", icon: Shield, label: "Intelligence" },
      { id: "military", icon: Globe, label: "Military" },
      { id: "political", icon: Users, label: "Political" },
      { id: "economic", icon: TrendingUp, label: "Economic" },
    ],
    rightPanel: {
      label: "Report Details",
      content: "Selected report information",
    },
    rightMostPanel: { label: "Sources", content: "Source attribution" },
    statusBar: {
      message: "OSINT Data - Open source intelligence",
      actions: [
        { icon: Search, label: "Search", onClick: () => {} },
        { icon: Download, label: "Export", onClick: () => {} },
      ],
    },
  },
};

const defaultNavIds: Record<ViewMode, string> = {
  flights: "all",
  satellites: "all",
  streams: "all",
  economic: "overview",
  conflicts: "all",
  alerts: "all",
  osint: "all",
};

interface AppLayoutProps {
  children: ReactNode;
  theme?: "light" | "dark";
  onThemeChange?: (theme: "light" | "dark") => void;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onExportCode?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onImportCode?: () => void;
  nodeCount?: number;
  connectionCount?: number;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToScreen?: () => void;
  onToggleGrid?: () => void;
  viewMode?: ViewMode;
  onSelectViewMode?: (mode: ViewMode) => void;
  viewModeOptions?: string[];
  viewModeLabels?: Record<string, { label: string; panelLabel: string }>;
}

export function AppLayout({
  children,
  theme = "light",
  onThemeChange,
  onNewProject,
  onOpenProject,
  onSave,
  onExportCode,
  onUndo,
  onRedo,
  onClear,
  onImportCode,
  nodeCount = 0,
  connectionCount = 0,
  zoom = 100,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onToggleGrid,
  viewMode,
  onSelectViewMode,
}: AppLayoutProps) {
  const [currentViewMode, setCurrentViewMode] = useQueryState("viewMode", {
    defaultValue: viewMode || "flights",
    shallow: false,
  });

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useQueryState("leftPanelCollapsed", {
    defaultValue: "true",
    shallow: false,
  });

  const [rightPanelCollapsed, setRightPanelCollapsed] = useQueryState("rightPanelCollapsed", {
    defaultValue: "true",
    shallow: false,
  });

  const [rightMostPanelCollapsed, setRightMostPanelCollapsed] = useQueryState(
    "rightMostPanelCollapsed",
    {
      defaultValue: "true",
      shallow: false,
    },
  );

  const [activeNavIdsJson, setActiveNavIdsJson] = useQueryState("activeNavIds", {
    defaultValue: JSON.stringify(defaultNavIds),
    shallow: false,
  });

  const activeNavIds = JSON.parse(activeNavIdsJson || "{}");

  const currentMode = (currentViewMode || "flights") as ViewMode;
  const config = viewModeConfigs[currentMode];
  const activeNavId = activeNavIds[currentMode] || defaultNavIds[currentMode];
  const activeNavItem = config.navigation.find((n) => n.id === activeNavId) || config.navigation[0];

  const handleNavigationChange = (navId: string) => {
    const newNavIds = { ...activeNavIds, [currentMode]: navId };
    void setActiveNavIdsJson(JSON.stringify(newNavIds));
  };

  const handleSelectViewMode = (mode: ViewMode) => {
    void setCurrentViewMode(mode);
    onSelectViewMode?.(mode);
  };

  const toggleTheme = () => {
    onThemeChange?.(theme === "light" ? "dark" : "light");
  };

  const handleLeftPanelToggle = () => {
    void setLeftPanelCollapsed((prev) => (prev === "true" ? "false" : "true"));
  };

  const handleRightPanelToggle = () => {
    void setRightPanelCollapsed((prev) => (prev === "true" ? "false" : "true"));
  };

  const handleRightMostPanelToggle = () => {
    void setRightMostPanelCollapsed((prev) => (prev === "true" ? "false" : "true"));
  };

  return (
    <div
      className={`flex flex-col h-screen ${theme === "dark" ? "bg-neutral-950 text-neutral-100" : "bg-white text-gray-900"}`}
    >
      <TitleBar
        theme={theme}
        toggleTheme={toggleTheme}
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onSave={onSave}
        onExportCode={onExportCode}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        onImportCode={onImportCode}
        onSelectViewMode={handleSelectViewMode}
        viewMode={currentMode}
        onToggleLeftPanel={handleLeftPanelToggle}
        onToggleRightPanel={handleRightPanelToggle}
        onToggleRightMostPanel={handleRightMostPanelToggle}
      />
      <div className="flex flex-1 overflow-hidden">
        <NavigationIconsStrip
          navigationItems={config.navigation}
          activeNavId={activeNavId}
          onNavigationChange={handleNavigationChange}
          theme={theme}
        />

        {leftPanelCollapsed === "true" ? (
          <LeftPanelStrip onClick={() => setLeftPanelCollapsed("false")} theme={theme} />
        ) : (
          <div
            className={`w-64 border-r ${theme === "dark" ? "border-neutral-800 bg-neutral-900" : "border-gray-200 bg-white"}`}
          >
            <div
              className={`p-2 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center justify-between`}
            >
              <span className="text-sm font-medium">{activeNavItem.label}</span>
              <button
                className={`text-xs ${theme === "dark" ? "text-neutral-400 hover:text-neutral-100" : "text-gray-500 hover:text-gray-900"}`}
                onClick={() => setLeftPanelCollapsed("true")}
              >
                Collapse
              </button>
            </div>
            <div className="p-4">
              <LeftPanel mode={currentMode} navId={activeNavId} />
            </div>
          </div>
        )}

        <div className="flex-1 flex min-w-0">{children}</div>

        {rightPanelCollapsed === "true" ? (
          <RightPanelStrip onClick={() => setRightPanelCollapsed("false")} theme={theme} />
        ) : (
          <div
            className={`w-64 border-l ${theme === "dark" ? "border-neutral-800 bg-neutral-900" : "border-gray-200 bg-white"}`}
          >
            <div
              className={`p-2 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center justify-between`}
            >
              <span className="text-sm font-medium">{config.rightPanel.label}</span>
              <button
                className={`text-xs ${theme === "dark" ? "text-neutral-400 hover:text-neutral-100" : "text-gray-500 hover:text-gray-900"}`}
                onClick={() => setRightPanelCollapsed("true")}
              >
                Collapse
              </button>
            </div>
            <div className="p-4">
              <RightPanel mode={currentMode} theme={theme} />
            </div>
          </div>
        )}

        {rightMostPanelCollapsed === "true" ? (
          <RightMostPanelStrip onClick={() => setRightMostPanelCollapsed("false")} theme={theme} />
        ) : (
          <div
            className={`w-64 border-l ${theme === "dark" ? "border-neutral-800 bg-neutral-900" : "border-gray-200 bg-white"}`}
          >
            <div
              className={`p-2 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center justify-between`}
            >
              <span className="text-sm font-medium">{config.rightMostPanel.label}</span>
              <button
                className={`text-xs ${theme === "dark" ? "text-neutral-400 hover:text-neutral-100" : "text-gray-500 hover:text-gray-900"}`}
                onClick={() => setRightMostPanelCollapsed("true")}
              >
                Collapse
              </button>
            </div>
            <div className="p-4">
              <RightMostPanel mode={currentMode} />
            </div>
          </div>
        )}
      </div>
      <BottomBar
        nodeCount={nodeCount}
        connectionCount={connectionCount}
        zoom={zoom}
        statusMessage={config.statusBar.message}
        actions={config.statusBar.actions}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitToScreen={onFitToScreen}
        onToggleGrid={onToggleGrid}
        theme={theme}
      />
    </div>
  );
}
