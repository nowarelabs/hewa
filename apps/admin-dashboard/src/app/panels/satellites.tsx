"use client";

import type { ReactElement } from "react";
import { Satellite as SatelliteIcon } from "lucide-react";

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
import { useFilterParam } from "../state/filter";
import { useSatellites, type SatelliteKind } from "../data/satellites";

/**
 * The `satellites` view: every panel the Satellites tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

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
  const { rows, status } = useSatellites();
  const entry = RAIL.find((candidate) => candidate.id === item) ?? RAIL[0];
  const kind = entry?.kind ?? null;
  const shown = kind === null ? rows : rows.filter((satellite) => satellite.kind === kind);

  return (
    <Panel title={entry?.label ?? "Satellites"}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: kind === null ? "satellites" : `${kind} satellites`,
          })}
        </Empty>
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
 * The bar counts kinds the service names, which is one more than the rail lists:
 * there is no scientific satellite in an air console's rail, and the bar used to
 * be built from the rail, so it counted the catalogue while the rail counted the
 * rail and neither had to agree with the other. `scientific` gets a chip and no
 * panel to open, which is the honest shape for a kind the rail does not offer.
 *
 * There is no timer on this view any more. The orbits used to be advanced every
 * five seconds, so the positions on screen were a random walk rather than an
 * observation — and the one bug worth remembering from that store was a second
 * listener set, which ticked the value without notifying anybody and left the
 * list rendering its initial positions with no error to explain it.
 */
export function SatelliteTable(): ReactElement {
  const { rows, groups, status } = useSatellites();
  const kinds = useFilterParam("satellites");
  const shown = visibleBy(rows, (satellite) => satellite.kind, kinds.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <SatelliteIcon className="h-5 w-5 text-purple-400" />
        <h1 className="text-lg font-semibold text-ink">Satellite tracker</h1>
        <span className="rounded bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">
          {rows.length} satellites
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (satellite) => satellite.kind, {
          keys: groups,
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
                  <Empty>
                    {emptyMessage({
                      status,
                      filtered: kinds.selected.length > 0,
                      noun: "satellites",
                      filter: "these kinds",
                    })}
                  </Empty>
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
