import { useState, useEffect } from "react";

export interface FlightData {
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

export interface FlightsResponse {
  timestamp: number;
  total: number;
  flights: FlightData[];
}

const WORKER_URL = "http://localhost:8787";
const POLL_INTERVAL_MS = 60000;

export function useFlights(endpoint: string) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    // Endpoint changed: drop the old data and show the loading state again
    setFlights([]);
    setLoading(true);
    setError(null);

    async function fetchFlights() {
      try {
        const response = await fetch(`${WORKER_URL}${endpoint}`, {
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
        timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [endpoint]);

  return { flights, loading, error, lastUpdate };
}

export function useAllFlights() {
  return useFlights("/api/flights/all");
}

export function useAirportFlights(airportCode: string) {
  return useFlights(`/api/flights/airport/${encodeURIComponent(airportCode)}`);
}

export function useAirlineFlights(airlineCode: string) {
  return useFlights(`/api/flights/airline/${encodeURIComponent(airlineCode)}`);
}
