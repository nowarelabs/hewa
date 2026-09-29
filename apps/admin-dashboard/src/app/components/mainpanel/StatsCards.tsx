import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Crosshair,
  Plane,
  Satellite,
  Radio,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface StatsCardsProps {
  theme?: "light" | "dark";
}

interface Stats {
  activeAlerts: number;
  activeConflicts: number;
  flightsInAirspace: number;
  satellitesOverhead: number;
  liveStreams: number;
  verifiedReports: number;
}

const mockStats: Stats = {
  activeAlerts: 24,
  activeConflicts: 8,
  flightsInAirspace: 12,
  satellitesOverhead: 5,
  liveStreams: 3,
  verifiedReports: 156,
};

export function StatsCards({ theme = "dark" }: StatsCardsProps) {
  const [stats, setStats] = useState<Stats>(mockStats);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        activeAlerts: Math.floor(Math.random() * 30) + 10,
        activeConflicts: Math.floor(Math.random() * 15) + 3,
        flightsInAirspace: Math.floor(Math.random() * 10) + 8,
        satellitesOverhead: Math.floor(Math.random() * 8) + 3,
        liveStreams: 3,
        verifiedReports: Math.floor(Math.random() * 50) + 140,
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      label: "Active Alerts",
      value: stats.activeAlerts,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
    },
    {
      label: "Active Conflicts",
      value: stats.activeConflicts,
      icon: Crosshair,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
    },
    {
      label: "Flights In Airspace",
      value: stats.flightsInAirspace,
      icon: Plane,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
    },
    {
      label: "Satellites Overhead",
      value: stats.satellitesOverhead,
      icon: Satellite,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
    },
    {
      label: "Live Streams",
      value: stats.liveStreams,
      icon: Radio,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
    },
    {
      label: "Verified Reports",
      value: stats.verifiedReports,
      icon: FileCheck,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
    },
  ];

  const isDark = theme === "dark";

  if (isCollapsed) {
    const totalStats =
      stats.activeAlerts +
      stats.activeConflicts +
      stats.flightsInAirspace +
      stats.satellitesOverhead +
      stats.liveStreams +
      stats.verifiedReports;
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`flex items-center justify-center w-full h-8 rounded-md ${isDark ? "bg-neutral-800 hover:bg-neutral-700" : "bg-gray-100 hover:bg-gray-200"}`}
        title="Click to expand stats"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span
              className={`text-sm font-medium ${isDark ? "text-neutral-300" : "text-gray-700"}`}
            >
              Stats
            </span>
            <span className={`text-xs ${isDark ? "text-neutral-500" : "text-gray-500"}`}>
              ({totalStats})
            </span>
          </div>
          <ChevronUp className={`w-4 h-4 ${isDark ? "text-neutral-400" : "text-gray-500"}`} />
        </div>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsCollapsed(true)}
        className={`absolute -top-2 right-0 z-10 flex items-center gap-1 text-xs px-2 py-1 rounded ${isDark ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
      >
        <ChevronDown className="w-3 h-3" />
        <span className="hidden sm:inline">Collapse</span>
      </button>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${card.bg} ${card.border} ${isDark ? "bg-neutral-900" : "bg-white"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${card.color}`}>{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
