"use client";

import { useEffect, useState } from "react";

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

/**
 * The OpenSky mirror. It is a local worker rather than an API this app owns,
 * so the origin and the interval are both named here and nowhere else.
 */
const WORKER_URL = process.env.NEXT_PUBLIC_FLIGHTS_WORKER_URL ?? "http://localhost:8787";
const POLL_INTERVAL_MS = 60_000;

export interface FlightsState {
  flights: FlightData[];
  loading: boolean;
  lastUpdate: Date | null;
}

const EMPTY: FlightsState = { flights: [], loading: true, lastUpdate: null };

/**
 * Polls one flights endpoint and re-polls on an interval.
 *
 * The main flight table and the left panel both need this data, and each used
 * to carry its own copy of the fetch loop. Two copies meant two pollers, and
 * the table's copy could not be given the loading state the panel already had.
 */
export function useFlights(endpoint: string): FlightsState {
  const [state, setState] = useState<FlightsState>(EMPTY);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    // The endpoint changed, so what is on screen describes the previous one.
    setState(EMPTY);

    async function poll(): Promise<void> {
      try {
        const response = await fetch(`${WORKER_URL}${endpoint}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`The flights worker answered ${String(response.status)}.`);
        }
        const data: FlightsResponse = await response.json();
        if (active) {
          setState({ flights: data.flights, loading: false, lastUpdate: new Date() });
        }
      } catch (cause) {
        // An abort is this hook cleaning up, not a failure to report.
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        // A failed poll keeps the rows it already had rather than reporting one.
        if (active) {
          setState((previous) => ({ ...previous, loading: false }));
        }
      } finally {
        if (active) {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      }
    }

    void poll();

    return () => {
      active = false;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      controller.abort();
    };
  }, [endpoint]);

  return state;
}

/**
 * Endpoint builders, exported because a panel that selects its own endpoint has
 * to name the same paths the wrappers below do. Two spellings of one route is
 * the kind of duplication that survives a route rename on the worker.
 */
export const ALL_FLIGHTS_ENDPOINT = "/api/flights/all";

export function airlineFlightsEndpoint(airlineCode: string): string {
  return `/api/flights/airline/${encodeURIComponent(airlineCode)}`;
}

export function airportFlightsEndpoint(airportCode: string): string {
  return `/api/flights/airport/${encodeURIComponent(airportCode)}`;
}

export function useAllFlights(): FlightsState {
  return useFlights(ALL_FLIGHTS_ENDPOINT);
}

export function useAirportFlights(airportCode: string): FlightsState {
  return useFlights(airportFlightsEndpoint(airportCode));
}

export function useAirlineFlights(airlineCode: string): FlightsState {
  return useFlights(airlineFlightsEndpoint(airlineCode));
}
