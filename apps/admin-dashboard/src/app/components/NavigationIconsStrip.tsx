import { LucideIcon } from "lucide-react";

export interface NavigationItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface NavigationIconsStripProps {
  navigationItems: NavigationItem[];
  activeNavId: string;
  onNavigationChange: (id: string) => void;
  theme?: "light" | "dark";
}

export function NavigationIconsStrip({
  navigationItems,
  activeNavId,
  onNavigationChange,
  theme = "light",
}: NavigationIconsStripProps) {
  const buttonStyle = "inline-flex items-center justify-center p-2 rounded-md transition-all";

  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 border-r ${theme === "dark" ? "border-neutral-800 bg-neutral-900" : "border-gray-200 bg-white"}`}
    >
      {navigationItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeNavId === item.id;
        return (
          <button
            key={item.id}
            className={`${buttonStyle} ${
              isActive
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : theme === "dark"
                  ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                  : "bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
            title={item.label}
            onClick={() => onNavigationChange(item.id)}
          >
            <IconComponent className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
