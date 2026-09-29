"use client";

export {
  ALL_FLIGHTS_ENDPOINT,
  airlineFlightsEndpoint,
  airportFlightsEndpoint,
  useAirportFlights,
  useAirlineFlights,
  useAllFlights,
  useFlights,
} from "./useFlights";

export type { FlightData, FlightsResponse, FlightsState } from "./useFlights";
