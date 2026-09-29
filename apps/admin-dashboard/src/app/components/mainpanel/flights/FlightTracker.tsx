import { useEffect, useState } from "react";
import { Plane, RefreshCw } from "lucide-react";

interface FlightData {
  icao24: string;
  callsign: string;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  isArriving: boolean;
  isDeparting: boolean;
}

interface FlightsResponse {
  timestamp: number;
  total: number;
  flights: FlightData[];
}

interface FlightTrackerProps {
  theme?: "light" | "dark";
}

const WORKER_URL = "http://localhost:8787";

function getAirlineFromCallsign(callsign: string): {
  airline: string;
  origin: string;
  destination: string;
} {
  const prefix = callsign.substring(0, 2).toUpperCase();
  const routes: Record<string, { airline: string; origin: string; destination: string }> = {
    KQ: { airline: "Kenya Airways", origin: "NBO", destination: "Unknown" },
    JM: { airline: "Jambojet", origin: "NBO", destination: "Unknown" },
    JB: { airline: "Jambojet", origin: "NBO", destination: "Unknown" },
    FY: { airline: "Fly540", origin: "NBO", destination: "Unknown" },
    "5F": { airline: "Fly540", origin: "NBO", destination: "Unknown" },
    FL: { airline: "Safarilink", origin: "NBO", destination: "Unknown" },
    FLC: { airline: "Safarilink", origin: "NBO", destination: "Unknown" },
    XK: { airline: "Safarilink", origin: "NBO", destination: "Unknown" },
  };
  return (
    routes[prefix] || {
      airline: "Unknown",
      origin: "Unknown",
      destination: "Unknown",
    }
  );
}

export function FlightTracker({ theme = "dark" }: FlightTrackerProps) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    async function fetchFlights() {
      try {
        const response = await fetch(`${WORKER_URL}/api/flights/all`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const data: FlightsResponse = await response.json();
        if (mounted) {
          setFlights(data.flights);
          setLastUpdate(new Date());
          setError(null);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mounted) {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    async function poll() {
      await fetchFlights();
      if (mounted) {
        timeoutId = setTimeout(poll, 60000);
      }
    }

    void poll();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-neutral-900" : "bg-white"}`}>
      <div
        className={`p-4 border-b ${theme === "dark" ? "border-neutral-800" : "border-gray-200"} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5 text-blue-400" />
          <h2
            className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Flight Tracker
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded ${theme === "dark" ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"}`}
          >
            {flights.length} flights
          </span>
        </div>
        <div
          className={`flex items-center gap-2 text-xs ${theme === "dark" ? "text-neutral-400" : "text-gray-500"}`}
        >
          <RefreshCw className="w-3 h-3" />
          {loading ? (
            <span>Loading...</span>
          ) : lastUpdate ? (
            <span>Updated {lastUpdate.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      {error && <div className="p-4 text-xs text-red-500">Error: {error}</div>}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm opacity-60">Loading flights...</div>
        </div>
      ) : flights.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm opacity-60">No flights detected</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead
              className={`sticky top-0 ${theme === "dark" ? "bg-neutral-800" : "bg-gray-100"}`}
            >
              <tr
                className={`text-xs ${theme === "dark" ? "text-neutral-400" : "text-gray-600"} text-left`}
              >
                <th className="px-4 py-2">Callsign</th>
                <th className="px-4 py-2">Airline</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Alt (m)</th>
                <th className="px-4 py-2">Speed (m/s)</th>
                <th className="px-4 py-2">Heading</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((flight, index) => {
                const airlineInfo = getAirlineFromCallsign(flight.callsign);
                return (
                  <tr
                    key={`${flight.icao24}-${flight.callsign}-${index}`}
                    className={`border-b border-neutral-800 hover:bg-neutral-800/50 ${
                      theme === "dark" ? "text-neutral-300" : "text-gray-700"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-blue-400">{flight.callsign}</td>
                    <td className="px-4 py-3">{airlineInfo.airline}</td>
                    <td className="px-4 py-3">{flight.originCountry}</td>
                    <td className="px-4 py-3 font-mono">
                      {Math.round(flight.altitude).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono">{Math.round(flight.velocity)}</td>
                    <td className="px-4 py-3 font-mono">{Math.round(flight.heading)}°</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
