"use client";

import type { ReactElement, ReactNode } from "react";
import { Plane } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import {
  CardList,
  Empty,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { useFlights } from "../data/flights";
import { useFilterParam } from "../state/filter";

/**
 * The `flights` view: every panel the Flights tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

/**
 * The carriers the rail lists. `carrier` is `null` for the one entry that means
 * every flight.
 *
 * The rail has no entry for "Unknown" and does not need one: it is a carrier as
 * far as the bar is concerned, and it is counted, but there is no panel a rail
 * entry could open. The rail is what to click; the bar is what is there.
 */
export const FLIGHT_RAIL: { id: string; label: string; carrier: string | null }[] = [
  { id: "all", label: "All flights", carrier: null },
  { id: "kenya", label: "Kenya Airways", carrier: "Kenya Airways" },
  { id: "jambo", label: "Jambojet", carrier: "Jambojet" },
  { id: "fly540", label: "Fly540", carrier: "Fly540" },
  { id: "safarilink", label: "Safarilink", carrier: "Safarilink" },
];

/**
 * The left column's flight list, for the whole airspace or for one carrier.
 *
 * The four carrier panels used to be four files differing only in a heading and
 * a slice length. Which carrier is selected is already known here, as `item`, so
 * the panel filters the one list it already has.
 *
 * There is no timer on this view any more. The positions used to be advanced
 * every five seconds by a store that subscribed to itself, which made the flights
 * look live without anything having observed them: a number from `Math.random()`
 * is not fresher than one that was invented once and sent, and it cost an
 * interval per mounted panel, a second copy of the records, and a "Updated"
 * timestamp reporting a change nobody made.
 */
export function FlightListPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useFlights();
  const entry = FLIGHT_RAIL.find((candidate) => candidate.id === item) ?? FLIGHT_RAIL[0];
  const carrier = entry?.carrier ?? null;
  const shown = carrier === null ? rows : rows.filter((flight) => flight.carrier === carrier);

  return (
    <Panel title={entry?.label ?? "Flights"}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: carrier === null ? "flights" : `${carrier} flights`,
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((flight) => ({
            id: flight.icao24,
            title: flight.callsign,
            detail: (
              <>
                {flight.originCountry} · {Math.round(flight.altitude).toLocaleString()} m
                {flight.isArriving ? " · Arriving" : flight.isDeparting ? " · Departing" : null}
              </>
            ),
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every flight, narrowed by carrier.
 *
 * This view used to be the only one with a search box as well, and the bar had
 * to become the field when asked: a carrier breakdown and a callsign lookup in
 * one strip, one at a time, with the other kept alive behind the swap. That
 * arrangement existed for the one view it was needed by, and it cost the shared
 * `SummaryBar` a state machine, a second set of controls and a second copy of
 * the filters so that a list of five chips could be turned into a text input.
 *
 * The carrier filter is the one control, and it acts: the bar counts what
 * pressing a chip leaves, and the table beneath it is what it counted. A callsign
 * is a field in the table, and the rows are the list to look a name up in.
 */
export function FlightTable(): ReactElement {
  const { rows, groups, status } = useFlights();
  const carriers = useFilterParam("flights");
  const shown = visibleBy(rows, (flight) => flight.carrier, carriers.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Plane className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Flight tracker</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} flights
        </span>
      </header>

      <SummaryBar
        items={[
          ...summaryCounts(rows, (flight) => flight.carrier, {
            keys: groups,
            label: (carrier) =>
              FLIGHT_RAIL.find((entry) => entry.carrier === carrier)?.label ??
              carrier.charAt(0).toUpperCase() + carrier.slice(1),
            tint: () => "border-accent/30 bg-accent/15 text-accent",
          }),
          {
            label: "Countries",
            value: new Set(rows.map((flight) => flight.originCountry)).size,
          },
        ]}
        filter={{
          label: "Filter by carrier",
          selected: carriers.selected,
          onToggle: carriers.toggle,
        }}
      />

      <Body>
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: carriers.selected.length > 0,
              noun: "flights",
              filter: "this carrier",
            })}
          </Empty>
        ) : (
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
                  <Td>{flight.carrier}</Td>
                  <Td>{flight.originCountry}</Td>
                  <Td className="font-mono">{Math.round(flight.altitude).toLocaleString()}</Td>
                  <Td className="font-mono">{Math.round(flight.velocity)}</Td>
                  <Td className="font-mono">{Math.round(flight.heading)}°</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Body>
    </div>
  );
}

function Body({ children }: { children: ReactNode }): ReactElement {
  return <div className="min-h-0 flex-1 overflow-auto">{children}</div>;
}

function Th({ children }: { children: string }): ReactElement {
  return <th className="px-4 py-2 font-normal">{children}</th>;
}

function Td({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
