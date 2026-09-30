"use client";

import type { ReactElement } from "react";
import { RefreshCw, Satellite } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, KeyValues, Panel } from "../ui/primitives";
import { createTickingStore, useStore } from "../state/store";

/**
 * The `satellites` view: every panel the Satellites tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

type SatelliteKind = "reconnaissance" | "weather" | "communication" | "navigation" | "scientific";

interface Satellite {
  id: string;
  name: string;
  kind: SatelliteKind;
  lat: number;
  lng: number;
  altitudeKm: number;
  velocityKms: number;
}

interface Catalog {
  satellites: Satellite[];
  lastUpdate: Date;
}

const SEED: Satellite[] = [
  {
    id: "1",
    name: "Landsat 8",
    kind: "reconnaissance",
    lat: 1.2345,
    lng: 36.789,
    altitudeKm: 705,
    velocityKms: 7.5,
  },
  {
    id: "2",
    name: "Sentinel-2A",
    kind: "reconnaissance",
    lat: -0.5678,
    lng: 37.456,
    altitudeKm: 786,
    velocityKms: 7.6,
  },
  {
    id: "3",
    name: "ISS",
    kind: "scientific",
    lat: 0.1234,
    lng: 38.901,
    altitudeKm: 408,
    velocityKms: 7.66,
  },
  {
    id: "4",
    name: "Starlink-1234",
    kind: "communication",
    lat: 2.3456,
    lng: 39.123,
    altitudeKm: 550,
    velocityKms: 7.5,
  },
  {
    id: "5",
    name: "GPS IIF-1",
    kind: "navigation",
    lat: -1.8901,
    lng: 36.234,
    altitudeKm: 20200,
    velocityKms: 3.9,
  },
];

const TICK_MS = 5000;

/**
 * Placeholder catalogue. The orbital feed is not built yet, so these drift on a
 * timer to show the columns moving. Replace the whole module when the real
 * source lands; nothing else in the app reads it.
 */
const CATALOG = createTickingStore<Catalog>(
  { satellites: SEED, lastUpdate: new Date() },
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

export function SatelliteTable(): ReactElement {
  const { satellites, lastUpdate } = useCatalog();

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-purple-400" />
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
            {satellites.map((satellite) => (
              <tr key={satellite.id} className="border-b border-line hover:bg-surface-raised">
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

export function OrbitalPanel(): ReactElement {
  const { satellites } = useCatalog();
  return (
    <Panel title="Orbital data">
      <KeyValues
        rows={satellites.slice(0, 6).map((satellite) => ({
          label: satellite.name,
          value: `${satellite.altitudeKm.toLocaleString()} km`,
        }))}
      />
    </Panel>
  );
}
