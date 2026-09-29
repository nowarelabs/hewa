import { LucideIcon } from "lucide-react";
import { ZoomIn, ZoomOut, Maximize2, Grid3X3, Clock } from "lucide-react";

export interface BottomBarAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

interface BottomBarProps {
  nodeCount?: number;
  connectionCount?: number;
  zoom?: number;
  statusMessage?: string;
  actions?: BottomBarAction[];
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToScreen?: () => void;
  onToggleGrid?: () => void;
  theme?: "light" | "dark";
}

export function BottomBar({
  nodeCount = 0,
  connectionCount = 0,
  zoom = 100,
  statusMessage = "",
  actions = [],
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onToggleGrid,
  theme = "light",
}: BottomBarProps) {
  const buttonStyle =
    theme === "dark"
      ? "inline-flex items-center justify-center h-7 px-2 text-xs font-medium border border-neutral-700 bg-neutral-800 shadow-sm hover:bg-neutral-700 hover:border-neutral-600 text-neutral-200 rounded transition-all"
      : "inline-flex items-center justify-center h-7 px-2 text-xs font-medium border border-gray-200 bg-white shadow-sm hover:bg-gray-100 hover:border-gray-300 text-gray-700 rounded transition-all";

  const isDark = theme === "dark";

  return (
    <div
      className={`border-t ${isDark ? "border-neutral-800 bg-neutral-950" : "border-gray-200 bg-white/80"} backdrop-blur-sm`}
    >
      <div className="hidden md:flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          {statusMessage && (
            <>
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-600"}`}>
                {statusMessage}
              </span>
              <div
                className={`h-4 border-r ${isDark ? "border-neutral-700" : "border-gray-200"}`}
              ></div>
            </>
          )}
          {actions.length > 0 ? (
            actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  className={buttonStyle}
                  onClick={action.onClick}
                  title={action.label}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {action.label}
                </button>
              );
            })
          ) : (
            <>
              <div
                className={`flex items-center gap-1 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}
              >
                <Grid3X3 className="w-3 h-3" />
                <span>{nodeCount} nodes</span>
              </div>
              <div
                className={`h-4 border-r ${isDark ? "border-neutral-700" : "border-gray-200"}`}
              ></div>
              <div
                className={`flex items-center gap-1 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}
              >
                <span>{connectionCount} connections</span>
              </div>
              <div
                className={`h-4 border-r ${isDark ? "border-neutral-700" : "border-gray-200"}`}
              ></div>
              <button className={buttonStyle} onClick={onToggleGrid} title="Toggle Grid">
                <Grid3X3 className="w-3 h-3 mr-1" />
                Grid
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}
          >
            <button className={buttonStyle} onClick={onZoomOut} title="Zoom Out">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="w-12 text-center">{zoom}%</span>
            <button className={buttonStyle} onClick={onZoomIn} title="Zoom In">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button className={buttonStyle} onClick={onFitToScreen} title="Fit to Screen">
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          <div
            className={`h-4 border-r ${isDark ? "border-neutral-700" : "border-gray-200"}`}
          ></div>
          <div
            className={`flex items-center gap-1 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}
          >
            <Clock className="w-3 h-3" />
            <span>Last saved: Just now</span>
          </div>
        </div>
      </div>

      <div className="md:hidden overflow-x-auto scrollbar-hide px-3 py-1.5">
        <div className="flex items-center justify-between min-w-max">
          <div
            className={`flex items-center gap-2 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}
          >
            <span>{nodeCount} nodes</span>
            <div
              className={`h-4 border-r ${isDark ? "border-neutral-700" : "border-gray-200"}`}
            ></div>
            <span>{connectionCount} connections</span>
          </div>

          <div
            className={`flex items-center gap-1 text-xs ${isDark ? "text-neutral-500" : "text-gray-500"} ml-4`}
          >
            <button className={buttonStyle} onClick={onZoomOut}>
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="w-10 text-center">{zoom}%</span>
            <button className={buttonStyle} onClick={onZoomIn}>
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
