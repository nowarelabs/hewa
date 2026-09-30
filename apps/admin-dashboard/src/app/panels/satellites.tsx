"use client";

import type { ReactElement } from "react";
import { RefreshCw, Satellite as SatelliteIcon } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, Panel, SummaryBar, summaryCounts, visibleBy } from "../ui/primitives";
import { useFilterParam } from "../state/filter";
import { KINDS, SATELLITES, type Satellite, type SatelliteKind } from "../data/satellites";
import { createTickingStore, useStore } from "../state/store";

/**
 * The `satellites` view: every panel the Satellites tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

interface Catalog {
  satellites: Satellite[];
  lastUpdate: Date;
}

const TICK_MS = 5000;

/**
 * Placeholder catalogue. The orbital feed is not built yet, so these drift on a
 * timer to show the columns moving. The records they start from are in `../data/satellites`.
 */
const CATALOG = createTickingStore<Catalog>(
  { satellites: SATELLITES, lastUpdate: new Date() },
  TICK_MS,
  (current) => ({
    satellites: current.satellites.map((satellite) => ({
      ...satellite,
      lat: satellite.lat + (Math.random() - 0.5) * 0.05,
      lng: satellite.lng + (Math.random() - 0.5) * 0.05,
    })),
    lastUpdate: new Date(),
  }),
);

function useCatalog(): Catalog {
  return useStore(CATALOG);
}

/**
 * `null` means no filter. The "All satellites" entry used to carry
 * `kind: "reconnaissance"`, so the one entry that is supposed to show the whole
 * catalogue showed the two reconnaissance satellites and the other four
 * appeared to have gone missing.
 */
const RAIL: { id: string; label: string; kind: SatelliteKind | null }[] = [
  { id: "all", label: "All satellites", kind: null },
  { id: "recon", label: "Reconnaissance", kind: "reconnaissance" },
  { id: "weather", label: "Weather", kind: "weather" },
  { id: "comm", label: "Communication", kind: "communication" },
  { id: "nav", label: "Navigation", kind: "navigation" },
];

/**
 * Every kind the catalogue can hold, which is one more than the rail lists.
 *
 * The rail has no entry for a scientific satellite because the air console does
 * not track them, and a kind with no rail entry would otherwise be a row in
 * the table that no chip accounts for. The bar counts the catalogue, not the
 * rail.
 */

const TINT: Record<SatelliteKind, string> = {
  reconnaissance: "text-purple-400 bg-purple-500/15",
  weather: "text-blue-400 bg-blue-500/15",
  communication: "text-green-400 bg-green-500/15",
  navigation: "text-cyan-400 bg-cyan-500/15",
  scientific: "text-yellow-400 bg-yellow-500/15",
};

export function SatelliteListPanel({ item }: PanelProps): ReactElement {
  const { satellites } = useCatalog();
  const entry = RAIL.find((candidate) => candidate.id === item) ?? RAIL[0];
  const kind = entry?.kind ?? null;
  const shown =
    kind === null ? satellites : satellites.filter((satellite) => satellite.kind === kind);

  return (
    <Panel title={entry?.label ?? "Satellites"}>
      {shown.length === 0 ? (
        <Empty>Nothing in this category is in view</Empty>
      ) : (
        <CardList
          items={shown.map((satellite) => ({
            id: satellite.id,
            title: satellite.name,
            detail: satellite.kind,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every satellite, filtered by kind.
 *
 * This is the one view whose rows move while you look at them, so the selection
 * is plain component state and not part of the ticking store: the catalogue
 * advances and the filter stays where the operator put it, and a filter that
 * reset itself on every tick would be unusable.
 */
export function SatelliteTable(): ReactElement {
  const { satellites, lastUpdate } = useCatalog();
  const kinds = useFilterParam("satellites");
  const shown = visibleBy(satellites, (satellite) => satellite.kind, kinds.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <SatelliteIcon className="h-5 w-5 text-purple-400" />
          <h1 className="text-lg font-semibold text-ink">Satellite tracker</h1>
          <span className="rounded bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">
            {satellites.length} satellites
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <RefreshCw className="h-3 w-3" />
          Updated {lastUpdate.toLocaleTimeString()}
        </div>
      </header>

      <SummaryBar
        items={summaryCounts(satellites, (satellite) => satellite.kind, {
          keys: KINDS,
          label: (kind) =>
            RAIL.find((entry) => entry.kind === kind)?.label ??
            kind.charAt(0).toUpperCase() + kind.slice(1),
          tint: () => "border-purple-500/30 bg-purple-500/15 text-purple-400",
        })}
        filter={{
          label: "Filter by kind",
          selected: kinds.selected,
          onToggle: kinds.toggle,
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-raised text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Satellite</th>
              <th className="px-4 py-2 font-normal">Type</th>
              <th className="px-4 py-2 font-normal">Coordinates</th>
              <th className="px-4 py-2 font-normal">Altitude (km)</th>
              <th className="px-4 py-2 font-normal">Velocity (km/s)</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  <Empty>No satellites match these kinds</Empty>
                </td>
              </tr>
            ) : null}
            {shown.map((satellite) => (
              <tr
                key={satellite.id}
                data-row={satellite.id}
                className="border-b border-line hover:bg-surface-raised"
              >
                <td className="px-4 py-3 font-medium text-purple-400">{satellite.name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs ${TINT[satellite.kind]}`}>
                    {satellite.kind}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  {satellite.lat.toFixed(4)}°, {satellite.lng.toFixed(4)}°
                </td>
                <td className="px-4 py-3 font-mono">{satellite.altitudeKm.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono">{satellite.velocityKms.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
