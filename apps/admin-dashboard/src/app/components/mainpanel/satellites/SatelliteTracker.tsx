import { useEffect, useState } from "react";
import { Satellite, RefreshCw } from "lucide-react";

interface SatelliteData {
  id: string;
  name: string;
  type: "reconnaissance" | "weather" | "communication" | "navigation" | "scientific";
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
}

interface SatelliteTrackerProps {
  theme?: "light" | "dark";
}

const initialSatellites: SatelliteData[] = [
  {
    id: "1",
    name: "Landsat 8",
    type: "reconnaissance",
    lat: 1.2345,
    lng: 36.789,
    altitude: 705,
    velocity: 7.5,
  },
  {
    id: "2",
    name: "Sentinel-2A",
    type: "reconnaissance",
    lat: -0.5678,
    lng: 37.456,
    altitude: 786,
    velocity: 7.6,
  },
  {
    id: "3",
    name: "ISS",
    type: "scientific",
    lat: 0.1234,
    lng: 38.901,
    altitude: 408,
    velocity: 7.66,
  },
  {
    id: "4",
    name: "Starlink-1234",
    type: "communication",
    lat: 2.3456,
    lng: 39.123,
    altitude: 550,
    velocity: 7.5,
  },
  {
    id: "5",
    name: "GPS IIF-1",
    type: "navigation",
    lat: -1.8901,
    lng: 36.234,
    altitude: 20200,
    velocity: 3.9,
  },
];

export function SatelliteTracker({ theme = "dark" }: SatelliteTrackerProps) {
  const [satellites, setSatellites] = useState<SatelliteData[]>(initialSatellites);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setSatellites((prevSatellites) =>
        prevSatellites.map((sat) => ({
          ...sat,
          lat: sat.lat + (Math.random() - 0.5) * 0.05,
          lng: sat.lng + (Math.random() - 0.5) * 0.05,
          velocity: sat.velocity + (Math.random() - 0.5) * 0.1,
        })),
      );
      setLastUpdate(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      reconnaissance: "text-purple-400 bg-purple-500/20",
      weather: "text-blue-400 bg-blue-500/20",
      communication: "text-green-400 bg-green-500/20",
      navigation: "text-cyan-400 bg-cyan-500/20",
      scientific: "text-yellow-400 bg-yellow-500/20",
    };
    return colors[type] || "text-neutral-400 bg-neutral-500/20";
  };

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-neutral-900" : "bg-white"}`}>
      <div
        className={`p-4 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-purple-400" />
          <h2
            className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Satellite Tracker
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded ${theme === "dark" ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700"}`}
          >
            {satellites.length} satellites
          </span>
        </div>
        <div
          className={`flex items-center gap-2 text-xs ${theme === "dark" ? "text-neutral-400" : "text-gray-500"}`}
        >
          <RefreshCw className="w-3 h-3" />
          <span>Updated {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className={`sticky top-0 ${theme === "dark" ? "bg-neutral-800" : "bg-gray-100"}`}>
            <tr
              className={`text-xs ${theme === "dark" ? "text-neutral-400" : "text-gray-600"} text-left`}
            >
              <th className="px-4 py-2">Satellite</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Coordinates</th>
              <th className="px-4 py-2">Altitude (km)</th>
              <th className="px-4 py-2">Velocity (km/s)</th>
            </tr>
          </thead>
          <tbody>
            {satellites.map((sat) => (
              <tr
                key={sat.id}
                className={`border-b border-neutral-800 hover:bg-neutral-800/50 ${
                  theme === "dark" ? "text-neutral-300" : "text-gray-700"
                }`}
              >
                <td className="px-4 py-3 font-medium text-purple-400">{sat.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(sat.type)}`}>
                    {sat.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  {sat.lat.toFixed(4)}°, {sat.lng.toFixed(4)}°
                </td>
                <td className="px-4 py-3 font-mono">{sat.altitude.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono">{sat.velocity.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
