import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  Trash2,
  LayoutGrid,
  Sun,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Sparkles,
  Settings,
  Plane,
  Satellite,
  Radio,
  BarChart,
  Crosshair,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { useState } from "react";

type ViewMode =
  | "flights"
  | "satellites"
  | "streams"
  | "economic"
  | "conflicts"
  | "alerts"
  | "osint";

interface TitleBarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onExportCode?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onImportCode?: () => void;
  onSelectViewMode?: (mode: ViewMode) => void;
  viewMode?: ViewMode;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  onToggleRightMostPanel?: () => void;
}

const viewModeLabels: Record<ViewMode, { label: string; icon: React.ElementType }> = {
  flights: { label: "Air", icon: Plane },
  satellites: { label: "Sats", icon: Satellite },
  streams: { label: "TV", icon: Radio },
  economic: { label: "Econ", icon: BarChart },
  conflicts: { label: "Conflicts", icon: Crosshair },
  alerts: { label: "Alerts", icon: AlertTriangle },
  osint: { label: "OSINT", icon: Globe },
};

export function TitleBar({
  theme,
  toggleTheme,
  onNewProject,
  onOpenProject,
  onSave,
  onExportCode,
  onUndo,
  onRedo,
  onClear,
  onImportCode,
  onSelectViewMode,
  viewMode = "flights",
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleRightMostPanel,
}: TitleBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const buttonStyle =
    theme === "dark"
      ? "inline-flex items-center justify-center gap-2 h-8 px-3 text-sm font-medium border border-neutral-700 bg-neutral-800 shadow-sm hover:bg-neutral-700 hover:border-neutral-600 text-neutral-200 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
      : "inline-flex items-center justify-center gap-2 h-8 px-3 text-sm font-medium border border-gray-200 bg-white shadow-sm hover:bg-gray-100 hover:border-gray-300 text-gray-700 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

  const iconButtonStyle =
    theme === "dark"
      ? "inline-flex items-center justify-center h-8 w-8 text-sm font-medium border border-neutral-700 bg-neutral-800 shadow-sm hover:bg-neutral-700 hover:border-neutral-600 text-neutral-200 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      : "inline-flex items-center justify-center h-8 w-8 text-sm font-medium border border-gray-200 bg-white shadow-sm hover:bg-gray-100 hover:border-gray-300 text-gray-700 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b ${theme === "dark" ? "border-neutral-800 bg-neutral-900" : "border-gray-200 bg-white"}`}
    >
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-6 h-6" />
        <div className="text-xl font-bold">NoSiasa</div>
      </div>

      <div className="hidden md:flex items-center gap-2 w-full">
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={buttonStyle} onClick={onNewProject} title="New Project">
          <FolderOpen className="w-4 h-4" />
        </button>
        <button className={buttonStyle} onClick={onOpenProject} title="Open Project">
          <Upload className="w-4 h-4" />
        </button>
        <button className={buttonStyle} onClick={onSave} title="Save">
          <Save className="w-4 h-4" />
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={iconButtonStyle} onClick={onUndo} title="Undo">
          <Undo2 className="w-4 h-4" />
        </button>
        <button className={iconButtonStyle} onClick={onRedo} title="Redo">
          <Redo2 className="w-4 h-4" />
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={buttonStyle} onClick={onImportCode} title="Import Code">
          <Upload className="w-4 h-4" />
          <span className="hidden lg:inline">Import</span>
        </button>
        <button className={buttonStyle} onClick={onExportCode} title="Export Code">
          <Download className="w-4 h-4" />
          <span className="hidden lg:inline">Export</span>
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>

        <div
          className={`flex items-center gap-1 p-2 ${theme === "dark" ? "border-r border-neutral-700" : "border-r border-gray-200"}`}
        >
          {(
            [
              "flights",
              "satellites",
              "streams",
              "economic",
              "conflicts",
              "alerts",
              "osint",
            ] as ViewMode[]
          ).map((mode, index, arr) => {
            const Icon = viewModeLabels[mode].icon;
            const isActive = viewMode === mode;
            const isFirst = index === 0;
            const isLast = index === arr.length - 1;
            return (
              <button
                key={mode}
                className={`inline-flex items-center justify-center gap-1 h-8 px-3 text-sm font-medium border transition-all ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                    : theme === "dark"
                      ? "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700 hover:text-neutral-200"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                } ${isFirst ? "rounded-l-md" : ""} ${isLast ? "rounded-r-md" : ""} ${!isFirst ? "-ml-px" : ""}`}
                onClick={() => onSelectViewMode?.(mode)}
                title={viewModeLabels[mode].label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{viewModeLabels[mode].label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1"></div>

        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={iconButtonStyle} onClick={onToggleLeftPanel} title="Toggle Left Panel">
          <PanelLeftClose className="w-4 h-4" />
        </button>
        <button className={iconButtonStyle} onClick={onToggleRightPanel} title="Toggle Right Panel">
          <PanelRightClose className="w-4 h-4" />
        </button>
        <button
          className={iconButtonStyle}
          onClick={onToggleRightMostPanel}
          title="Toggle AI Panel"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={iconButtonStyle} onClick={toggleTheme} title="Toggle Theme">
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        <button className={iconButtonStyle} onClick={onClear} title="Clear Canvas">
          <Trash2 className="w-4 h-4" />
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
          <span className="text-xs text-white font-bold">NB</span>
        </div>
      </div>

      <div className="md:hidden flex items-center gap-2 w-full">
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={iconButtonStyle} onClick={onNewProject} title="New">
          <FolderOpen className="w-4 h-4" />
        </button>
        <div
          className={`h-6 border-r ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}
        ></div>
        <button className={iconButtonStyle} onClick={onSave} title="Save">
          <Save className="w-4 h-4" />
        </button>

        <div className="flex-1"></div>

        <button className={iconButtonStyle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <Settings className="w-4 h-4" />
        </button>

        {isMenuOpen && (
          <div
            className={`absolute top-12 right-3 z-50 w-48 border ${theme === "dark" ? "bg-neutral-800 border-neutral-700" : "bg-white border-gray-200"} shadow-lg rounded-md`}
          >
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onOpenProject?.();
              }}
            >
              <Upload className="w-4 h-4" />
              Open Project
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onImportCode?.();
              }}
            >
              <Upload className="w-4 h-4" />
              Import Code
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onExportCode?.();
              }}
            >
              <Download className="w-4 h-4" />
              Export Code
            </button>
            <div
              className={`border-t ${theme === "dark" ? "border-neutral-700" : "border-gray-200"} my-1`}
            ></div>
            <div
              className={`px-2 py-1 text-xs ${theme === "dark" ? "text-neutral-500" : "text-gray-500"}`}
            >
              View Mode
            </div>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("flights");
              }}
            >
              <Plane className="w-4 h-4" />
              Flights
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("satellites");
              }}
            >
              <Satellite className="w-4 h-4" />
              Satellites
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("streams");
              }}
            >
              <Radio className="w-4 h-4" />
              Streams
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("economic");
              }}
            >
              <BarChart className="w-4 h-4" />
              Economic
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("conflicts");
              }}
            >
              <Crosshair className="w-4 h-4" />
              Conflicts
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("alerts");
              }}
            >
              <AlertTriangle className="w-4 h-4" />
              Alerts
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onSelectViewMode?.("osint");
              }}
            >
              <Globe className="w-4 h-4" />
              OSINT
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onToggleLeftPanel?.();
              }}
            >
              <PanelLeftClose className="w-4 h-4" />
              Left Panel
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onToggleRightPanel?.();
              }}
            >
              <PanelRightClose className="w-4 h-4" />
              Right Panel
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                toggleTheme();
              }}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              Toggle Theme
            </button>
            <button
              className={`w-full text-left px-3 py-2 text-sm hover:${theme === "dark" ? "bg-neutral-700" : "bg-gray-100"} ${theme === "dark" ? "text-neutral-200" : "text-gray-900"} flex items-center gap-2`}
              onClick={() => {
                setIsMenuOpen(false);
                onClear?.();
              }}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        )}

        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
          <span className="text-xs text-white font-bold">NB</span>
        </div>
      </div>
    </div>
  );
}
