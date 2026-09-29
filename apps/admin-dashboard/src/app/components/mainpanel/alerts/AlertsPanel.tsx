import { AlertTriangle, MapPin, Clock, Shield, Cloud, Heart, Car, DollarSign } from "lucide-react";

interface Alert {
  id: string;
  title: string;
  description: string;
  category: "security" | "conflict" | "economic" | "weather" | "health" | "traffic";
  severity: "critical" | "high" | "medium" | "low";
  lat: number;
  lng: number;
  county: string;
  timestamp: string;
}

interface AlertsPanelProps {
  theme?: "light" | "dark";
}

const alerts: Alert[] = [
  {
    id: "1",
    title: "Security Alert: Suspected Militant Activity",
    description:
      "Intelligence reports indicate potential militant activity in Mandera County border region.",
    category: "security",
    severity: "critical",
    lat: 4.2312,
    lng: 40.867,
    county: "Mandera",
    timestamp: "2026-03-26T09:15:00Z",
  },
  {
    id: "2",
    title: "Weather Warning: Heavy Rainfall",
    description:
      "Meteological department forecasts heavy rains in Western Kenya over the next 48 hours.",
    category: "weather",
    severity: "high",
    lat: 0.5634,
    lng: 34.7518,
    county: "Kakamega",
    timestamp: "2026-03-26T08:00:00Z",
  },
  {
    id: "3",
    title: "Health Alert: Disease Outbreak",
    description:
      "Confirmed cases of cholera reported in Homa Bay County. Health officials on high alert.",
    category: "health",
    severity: "high",
    lat: -0.5273,
    lng: 34.4571,
    county: "Homa Bay",
    timestamp: "2026-03-26T07:30:00Z",
  },
  {
    id: "4",
    title: "Traffic Advisory: Road Closure",
    description: "Mombasa-Nairobi highway partially closed due to accident. Expect delays.",
    category: "traffic",
    severity: "medium",
    lat: -1.1569,
    lng: 37.0742,
    county: "Machakos",
    timestamp: "2026-03-26T06:45:00Z",
  },
  {
    id: "5",
    title: "Economic Alert: Currency Fluctuation",
    description:
      "KES experiencing significant volatility against major currencies. Markets reacting to global events.",
    category: "economic",
    severity: "medium",
    lat: -1.2921,
    lng: 36.8219,
    county: "Nairobi",
    timestamp: "2026-03-26T06:00:00Z",
  },
  {
    id: "6",
    title: "Security Alert: Armed Robbery",
    description: "Multiple reports of armed robberies along Nairobi-Nakuru corridor.",
    category: "security",
    severity: "medium",
    lat: -0.4581,
    lng: 36.0527,
    county: "Nakuru",
    timestamp: "2026-03-25T23:00:00Z",
  },
  {
    id: "7",
    title: "Weather Advisory: High Winds",
    description: "Strong winds expected in Turkana region. Residents advised to secure property.",
    category: "weather",
    severity: "low",
    lat: 3.3256,
    lng: 35.5821,
    county: "Turkana",
    timestamp: "2026-03-25T18:00:00Z",
  },
  {
    id: "8",
    title: "Conflict Warning: Tensions Rising",
    description: "Increased tensions reported between communities in Marsabit. Monitor closely.",
    category: "conflict",
    severity: "high",
    lat: 2.6845,
    lng: 37.9895,
    county: "Marsabit",
    timestamp: "2026-03-25T16:30:00Z",
  },
];

export function AlertsPanel({ theme = "dark" }: AlertsPanelProps) {
  const isDark = theme === "dark";
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: isDark
        ? "bg-red-500/20 border-red-500 text-red-400"
        : "bg-red-100 border-red-400 text-red-700",
      high: isDark
        ? "bg-orange-500/20 border-orange-500 text-orange-400"
        : "bg-orange-100 border-orange-400 text-orange-700",
      medium: isDark
        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
        : "bg-cyan-100 border-cyan-400 text-cyan-700",
      low: isDark
        ? "bg-green-500/20 border-green-500 text-green-400"
        : "bg-green-100 border-green-400 text-green-700",
    };
    return (
      colors[severity] ||
      (isDark
        ? "bg-neutral-500/20 border-neutral-500 text-neutral-400"
        : "bg-gray-100 border-gray-400 text-gray-700")
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, typeof Shield> = {
      security: Shield,
      conflict: AlertTriangle,
      economic: DollarSign,
      weather: Cloud,
      health: Heart,
      traffic: Car,
    };
    return icons[category] || AlertTriangle;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      security: "text-red-400",
      conflict: "text-orange-400",
      economic: "text-yellow-400",
      weather: "text-blue-400",
      health: "text-green-400",
      traffic: "text-purple-400",
    };
    return colors[category] || "text-neutral-400";
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const mediumCount = alerts.filter((a) => a.severity === "medium").length;
  const lowCount = alerts.filter((a) => a.severity === "low").length;

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-neutral-900" : "bg-white"}`}>
      <div
        className={`p-4 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center gap-2`}
      >
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h2
          className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Alerts Panel
        </h2>
        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
          {alerts.length} alerts
        </span>
      </div>

      <div
        className={`p-3 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex gap-2`}
      >
        <span
          className={`text-xs px-2 py-1 rounded ${theme === "dark" ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"}`}
        >
          Critical: {criticalCount}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${theme === "dark" ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"}`}
        >
          High: {highCount}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${theme === "dark" ? "bg-cyan-500/20 text-cyan-400" : "bg-cyan-100 text-cyan-700"}`}
        >
          Medium: {mediumCount}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${theme === "dark" ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"}`}
        >
          Low: {lowCount}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {alerts.map((alert) => {
            const CategoryIcon = getCategoryIcon(alert.category);
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start gap-3">
                  <CategoryIcon className={`w-5 h-5 mt-0.5 ${getCategoryColor(alert.category)}`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3
                        className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        {alert.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-neutral-400" : "text-gray-600"} mb-2`}
                    >
                      {alert.description}
                    </p>
                    <div
                      className={`flex flex-wrap items-center gap-3 text-xs ${theme === "dark" ? "text-neutral-500" : "text-gray-500"}`}
                    >
                      <span
                        className={`flex items-center gap-1 ${getCategoryColor(alert.category)}`}
                      >
                        <CategoryIcon className="w-3 h-3" />
                        {alert.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {alert.county}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-mono">
                          {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
