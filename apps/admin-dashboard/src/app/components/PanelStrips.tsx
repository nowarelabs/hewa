import { ChevronRight } from "lucide-react";

interface PanelStripProps {
  side: "left" | "right";
  onClick: () => void;
  theme?: "light" | "dark";
}

export function PanelStrip({ side, onClick, theme = "light" }: PanelStripProps) {
  const isDark = theme === "dark";
  return (
    <div
      className={`flex flex-col border-l border-r cursor-pointer ${
        isDark ? "border-neutral-800 hover:bg-blue-600" : "border-gray-200 hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      <div
        className={`flex items-center justify-center h-full min-h-50 ${isDark ? "text-white" : "text-gray-400"}`}
      >
        <ChevronRight className={`w-4 h-4 ${side === "right" ? "rotate-180" : ""}`} />
      </div>
    </div>
  );
}

interface LeftPanelStripProps {
  onClick: () => void;
  theme?: "light" | "dark";
}

export function LeftPanelStrip({ onClick, theme = "light" }: LeftPanelStripProps) {
  return <PanelStrip side="left" onClick={onClick} theme={theme} />;
}

interface RightPanelStripProps {
  onClick: () => void;
  theme?: "light" | "dark";
}

export function RightPanelStrip({ onClick, theme = "light" }: RightPanelStripProps) {
  return <PanelStrip side="right" onClick={onClick} theme={theme} />;
}

interface RightMostPanelStripProps {
  onClick: () => void;
  theme?: "light" | "dark";
}

export function RightMostPanelStrip({ onClick, theme = "light" }: RightMostPanelStripProps) {
  return <PanelStrip side="right" onClick={onClick} theme={theme} />;
}
