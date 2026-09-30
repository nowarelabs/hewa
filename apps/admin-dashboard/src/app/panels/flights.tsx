"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Plane, RefreshCw } from "lucide-react";

import { ALL_FLIGHTS_ENDPOINT, airlineFlightsEndpoint, useAllFlights, useFlights } from "../hooks";
import type { FlightData } from "../hooks";
import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, Panel, SummaryBar, summaryCounts, visibleBy } from "../ui/primitives";
import { matchesQuery } from "../ui/controls";
import { useFilterParam, useSearchParam } from "../state/filter";

/**
 * The `flights` view: every panel the Flights tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

/**
 * Callsign prefixes as they appear on Kenyan domestic services. The worker
 * returns the callsign and not the operator, and a table of bare callsigns is
 * not much of a table.
 */
const AIRLINES: Record<string, string> = {
  KQ: "Kenya Airways",
  JM: "Jambojet",
  JB: "Jambojet",
  FY: "Fly540",
  "5F": "Fly540",
  FL: "Safarilink",
  FLC: "Safarilink",
  XK: "Safarilink",
};

export function airlineFor(callsign: string): string {
  return AIRLINES[callsign.slice(0, 2).toUpperCase()] ?? "Unknown";
}

/**
 * The carriers the summary bar names, in the order the table above them does.
 *
 * "Unknown" is in the list on purpose: `airlineFor` returns it for a prefix
 * this table has never heard of, and a chip that reads "Unknown: 2" is how that
 * shows up instead of two rows quietly claiming to be nobody's.
 */
const CARRIERS = [...new Set([...Object.values(AIRLINES), "Unknown"])];

const AIRLINE_CODES: Record<string, string | undefined> = {
  kenya: "KQ",
  jambo: "JMB",
  fly540: "FY",
  safarilink: "XK",
};

/**
 * The left column's flight list, for the whole airspace or for one carrier.
 *
 * The four carrier panels used to be four files differing only in a heading and
 * a slice length, each declaring its own copy of `FlightData` and each handed a
 * different fetch from a switch statement. Which carrier is selected is already
 * known here, as `item`, so the panel derives the endpoint from it and polls
 * that one endpoint. Selecting a carrier used to start a second poller for the
 * whole airspace alongside the one on screen, because hooks cannot be called
 * conditionally and the cheap way out was to call both and discard one.
 */
export function FlightListPanel({
  item,
  limit = 20,
}: PanelProps & { limit?: number }): ReactElement {
  const codes = AIRLINE_CODES[item ?? "all"] ?? undefined;
  const state = useFlights(
    codes === undefined ? ALL_FLIGHTS_ENDPOINT : airlineFlightsEndpoint(codes),
  );
  const { flights, loading, error } = state;

  const shown = useMemo(() => flights.slice(0, limit), [flights, limit]);

  if (error !== null) {
    return <Panel title="Flights" note={`The flights worker is unreachable: ${error}`} />;
  }

  return (
    <Panel title={codes === undefined ? "All flights" : airlineFor(codes)}>
      {loading ? <Empty>Loading flights…</Empty> : null}
      {!loading && flights.length === 0 ? <Empty>No flights detected</Empty> : null}
      <CardList items={shown.map(toCard)} />
      {flights.length > limit ? <Empty>+{flights.length - limit} more flights</Empty> : null}
    </Panel>
  );
}

function toCard(flight: FlightData): {
  id: string;
  title: string;
  detail: ReactElement | string;
} {
  const status = flight.isArriving ? "Arriving" : flight.isDeparting ? "Departing" : null;
  return {
    id: flight.icao24,
    title: flight.callsign,
    detail: (
      <>
        {flight.originCountry} · {Math.round(flight.altitude).toLocaleString()} m
        {status === null ? null : ` · ${status}`}
      </>
    ),
  };
}

/**
 * The main column: every flight, narrowed by carrier and looked up by text.
 *
 * The only view that gets both controls, and the reason it is the only one is
 * that the two answer different questions about a different shape of data. A
 * carrier says how many there are; a callsign says which one you meant. The
 * other four views have a handful of rows and a category, which is one control.
 */
export function FlightTable(): ReactElement {
  const { flights, loading, error, lastUpdate } = useAllFlights();
  const carriers = useFilterParam("flights");
  const search = useSearchParam("flightsQ");

  const narrowed = visibleBy(flights, (flight) => airlineFor(flight.callsign), carriers.selected);
  const shown = useMemo(
    () =>
      search.query.trim() === ""
        ? narrowed
        : narrowed.filter((flight) =>
            matchesQuery(
              search.query,
              flight.callsign,
              airlineFor(flight.callsign),
              flight.originCountry,
            ),
          ),
    [narrowed, search.query],
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold text-ink">Flight tracker</h1>
          <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
            {flights.length} flights
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <RefreshCw className="h-3 w-3" />
          {loading
            ? "Loading…"
            : lastUpdate === null
              ? ""
              : `Updated ${lastUpdate.toLocaleTimeString()}`}
        </div>
      </header>

      <SummaryBar
        items={[
          ...summaryCounts(flights, (flight) => airlineFor(flight.callsign), {
            // Every carrier the callsign table knows, so the bar keeps its
            // chips while the worker is loading and does not lose one to a
            // prefix that arrived after this table was written.
            keys: CARRIERS,
            tint: () => "border-accent/30 bg-accent/15 text-accent",
          }),
          {
            label: "Countries",
            value: new Set(flights.map((flight) => flight.originCountry)).size,
          },
        ]}
        filter={{
          label: "Filter by carrier",
          selected: carriers.selected,
          onToggle: carriers.toggle,
        }}
        search={{
          value: search.query,
          onChange: search.set,
          label: "Search flights by callsign, carrier or country",
          placeholder: "Callsign, carrier, country",
          hint: `${shown.length} of ${flights.length}`,
        }}
      />

      {error !== null ? (
        <p className="p-4 text-xs text-red-400">The flights worker is unreachable: {error}</p>
      ) : null}

      {loading ? (
        <Body>
          <Empty>Loading flights…</Empty>
        </Body>
      ) : flights.length === 0 ? (
        <Body>
          <Empty>No flights detected</Empty>
        </Body>
      ) : shown.length === 0 ? (
        <Body>
          <Empty>No flights match this carrier or search</Empty>
        </Body>
      ) : (
        <Body>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-raised text-xs text-ink-muted">
              <tr>
                <Th>Callsign</Th>
                <Th>Airline</Th>
                <Th>Country</Th>
                <Th>Altitude (m)</Th>
                <Th>Speed (m/s)</Th>
                <Th>Heading</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((flight) => (
                <tr
                  key={flight.icao24}
                  data-row={flight.icao24}
                  className="border-b border-line hover:bg-surface-raised"
                >
                  <Td className="font-medium text-accent">{flight.callsign}</Td>
                  <Td>{airlineFor(flight.callsign)}</Td>
                  <Td>{flight.originCountry}</Td>
                  <Td className="font-mono">{Math.round(flight.altitude).toLocaleString()}</Td>
                  <Td className="font-mono">{Math.round(flight.velocity)}</Td>
                  <Td className="font-mono">{Math.round(flight.heading)}°</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Body>
      )}
    </div>
  );
}

function Body({ children }: { children: ReactElement }): ReactElement {
  return <div className="min-h-0 flex-1 overflow-auto">{children}</div>;
}

function Th({ children }: { children: string }): ReactElement {
  return <th className="px-4 py-2 font-normal">{children}</th>;
}

function Td({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
