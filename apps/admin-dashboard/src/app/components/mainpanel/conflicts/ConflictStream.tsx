import { Crosshair, MapPin, Shield, Clock, UserCheck, AlertCircle } from "lucide-react";

interface Conflict {
  id: string;
  title: string;
  description: string;
  county: string;
  subCounty: string;
  type: "armed" | "protest" | "election" | "resource" | "tribal";
  severity: "critical" | "high" | "medium" | "low";
  casualties: number;
  verified: boolean;
  timestamp: string;
}

interface ConflictStreamProps {
  theme?: "light" | "dark";
}

const conflicts: Conflict[] = [
  {
    id: "1",
    title: "Pastoralist Conflict in Marsabit",
    description:
      "Inter-communal violence between pastoralist groups over grazing rights and water resources.",
    county: "Marsabit",
    subCounty: "North Horr",
    type: "tribal",
    severity: "high",
    casualties: 12,
    verified: true,
    timestamp: "2026-03-26T08:30:00Z",
  },
  {
    id: "2",
    title: "Election-related Protests in Kisumu",
    description: "Demonstrations following disputed election results with reports of clashes.",
    county: "Kisumu",
    subCounty: "Kisumu Central",
    type: "election",
    severity: "medium",
    casualties: 5,
    verified: true,
    timestamp: "2026-03-26T07:15:00Z",
  },
  {
    id: "3",
    title: "Land Dispute in Nakuru",
    description: "Violent confrontation over land ownership in Rift Valley region.",
    county: "Nakuru",
    subCounty: "Naivasha",
    type: "resource",
    severity: "high",
    casualties: 8,
    verified: false,
    timestamp: "2026-03-26T06:00:00Z",
  },
  {
    id: "4",
    title: "Armed Robbery in Nairobi",
    description: "Organized criminal activity targeting businesses and individuals.",
    county: "Nairobi",
    subCounty: "Dagoretti",
    type: "armed",
    severity: "medium",
    casualties: 2,
    verified: true,
    timestamp: "2026-03-25T22:45:00Z",
  },
  {
    id: "5",
    title: "Protests in Mombasa",
    description: "Peaceful demonstrations demanding better services and infrastructure.",
    county: "Mombasa",
    subCounty: "Mombasa Central",
    type: "protest",
    severity: "low",
    casualties: 0,
    verified: true,
    timestamp: "2026-03-25T18:30:00Z",
  },
];

export function ConflictStream({ theme = "dark" }: ConflictStreamProps) {
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "text-red-400 bg-red-500/20 border-red-500/30",
      high: "text-orange-400 bg-orange-500/20 border-orange-500/30",
      medium: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
      low: "text-green-400 bg-green-500/20 border-green-500/30",
    };
    return colors[severity] || "text-neutral-400 bg-neutral-500/20";
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      armed: "text-red-400",
      protest: "text-yellow-400",
      election: "text-blue-400",
      resource: "text-orange-400",
      tribal: "text-purple-400",
    };
    return colors[type] || "text-neutral-400";
  };

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-neutral-900" : "bg-white"}`}>
      <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
        <Crosshair className="w-5 h-5 text-orange-400" />
        <h2
          className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Conflict Stream
        </h2>
        <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
          {conflicts.length} incidents
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`p-4 rounded-lg border ${
                theme === "dark"
                  ? "bg-neutral-800 border-neutral-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {conflict.title}
                </h3>
                <div className="flex items-center gap-2">
                  {conflict.verified ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <UserCheck className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <AlertCircle className="w-3 h-3" />
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              <p className={`text-sm text-neutral-400 mb-3`}>{conflict.description}</p>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`flex items-center gap-1 ${getTypeColor(conflict.type)}`}>
                  <Shield className="w-3 h-3" />
                  {conflict.type}
                </span>
                <span className="flex items-center gap-1 text-neutral-400">
                  <MapPin className="w-3 h-3" />
                  {conflict.county} / {conflict.subCounty}
                </span>
                <span
                  className={`px-2 py-0.5 rounded border ${getSeverityColor(conflict.severity)}`}
                >
                  {conflict.severity}
                </span>
                {conflict.casualties > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {conflict.casualties} casualties
                  </span>
                )}
                <span className="flex items-center gap-1 text-neutral-500">
                  <Clock className="w-3 h-3" />
                  {new Date(conflict.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
