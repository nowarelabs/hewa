"use client";

import type { ReactElement } from "react";
import { AlertCircle, Clock, Crosshair, MapPin, Shield, UserCheck } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, KeyValues, Panel } from "../ui/primitives";

/**
 * The `conflicts` view: every panel the Conflicts tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

type IncidentKind = "armed" | "protest" | "election" | "resource" | "tribal";
type Severity = "critical" | "high" | "medium" | "low";

interface Incident {
  id: string;
  title: string;
  description: string;
  county: string;
  subCounty: string;
  kind: IncidentKind;
  severity: Severity;
  casualties: number;
  verified: boolean;
  reportedAt: string;
}

const SEVERITY_TINT: Record<Severity, string> = {
  critical: "text-red-400 bg-red-500/15 border-red-500/30",
  high: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  medium: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  low: "text-green-400 bg-green-500/15 border-green-500/30",
};

const KIND_TINT: Record<IncidentKind, string> = {
  armed: "text-red-400",
  protest: "text-yellow-400",
  election: "text-blue-400",
  resource: "text-orange-400",
  tribal: "text-purple-400",
};

const INCIDENTS: Incident[] = [
  {
    id: "1",
    title: "Pastoralist conflict in Marsabit",
    description:
      "Inter-communal violence between pastoralist groups over grazing rights and water resources.",
    county: "Marsabit",
    subCounty: "North Horr",
    kind: "tribal",
    severity: "high",
    casualties: 12,
    verified: true,
    reportedAt: "2026-03-26T08:30:00Z",
  },
  {
    id: "2",
    title: "Election-related protests in Kisumu",
    description: "Demonstrations following disputed election results with reports of clashes.",
    county: "Kisumu",
    subCounty: "Kisumu Central",
    kind: "protest",
    severity: "medium",
    casualties: 5,
    verified: true,
    reportedAt: "2026-03-26T07:15:00Z",
  },
  {
    id: "3",
    title: "Land dispute in Nakuru",
    description: "Violent confrontation over land ownership in the Rift Valley region.",
    county: "Nakuru",
    subCounty: "Naivasha",
    kind: "resource",
    severity: "high",
    casualties: 8,
    verified: false,
    reportedAt: "2026-03-26T06:00:00Z",
  },
  {
    id: "4",
    title: "Armed robbery in Nairobi",
    description: "Organised criminal activity targeting businesses and individuals.",
    county: "Nairobi",
    subCounty: "Dagoretti",
    kind: "armed",
    severity: "medium",
    casualties: 2,
    verified: true,
    reportedAt: "2026-03-25T22:45:00Z",
  },
  {
    id: "5",
    title: "Protests in Mombasa",
    description: "Peaceful demonstrations demanding better services and infrastructure.",
    county: "Mombasa",
    subCounty: "Mombasa Central",
    kind: "protest",
    severity: "low",
    casualties: 0,
    verified: true,
    reportedAt: "2026-03-25T18:30:00Z",
  },
];

const RAIL: Record<string, { title: string; kind: IncidentKind | null }> = {
  all: { title: "All incidents", kind: null },
  armed: { title: "Armed", kind: "armed" },
  protest: { title: "Protests", kind: "protest" },
  tribal: { title: "Tribal", kind: "tribal" },
  resource: { title: "Resource", kind: "resource" },
};

export function IncidentRailPanel({ item }: PanelProps): ReactElement {
  const entry = RAIL[item ?? "all"] ?? RAIL["all"];
  const kind = entry?.kind ?? null;
  const shown = kind === null ? INCIDENTS : INCIDENTS.filter((incident) => incident.kind === kind);

  return (
    <Panel title={entry?.title ?? "Incidents"}>
      {shown.length === 0 ? (
        <Empty>No incidents of this kind are open</Empty>
      ) : (
        <CardList
          items={shown.map((incident) => ({
            id: incident.id,
            title: incident.title,
            detail: `${incident.county} · ${incident.severity}`,
          }))}
        />
      )}
    </Panel>
  );
}

export function ConflictStream(): ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Crosshair className="h-5 w-5 text-orange-400" />
        <h1 className="text-lg font-semibold text-ink">Conflict stream</h1>
        <span className="rounded bg-orange-500/15 px-2 py-0.5 text-xs text-orange-400">
          {INCIDENTS.length} incidents
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {INCIDENTS.map((incident) => (
          <article
            key={incident.id}
            className="rounded-lg border border-line bg-surface-raised p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-medium text-ink">{incident.title}</h2>
              <span
                className={`flex shrink-0 items-center gap-1 text-xs ${
                  incident.verified ? "text-green-400" : "text-yellow-400"
                }`}
              >
                {incident.verified ? (
                  <UserCheck className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {incident.verified ? "Verified" : "Unverified"}
              </span>
            </div>

            <p className="mb-3 text-sm text-ink-muted">{incident.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${KIND_TINT[incident.kind]}`}>
                <Shield className="h-3 w-3" />
                {incident.kind}
              </span>
              <span className="flex items-center gap-1 text-ink-muted">
                <MapPin className="h-3 w-3" />
                {incident.county} / {incident.subCounty}
              </span>
              <span className={`rounded border px-2 py-0.5 ${SEVERITY_TINT[incident.severity]}`}>
                {incident.severity}
              </span>
              {incident.casualties > 0 ? (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {incident.casualties} casualties
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-ink-faint">
                <Clock className="h-3 w-3" />
                {new Date(incident.reportedAt).toLocaleString()}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function IncidentDetailsPanel(): ReactElement {
  const first = INCIDENTS[0];
  return (
    <Panel title="Incident details">
      {first === undefined ? (
        <Empty>Select an incident</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Title", value: first.title },
            {
              label: "Location",
              value: `${first.county} / ${first.subCounty}`,
            },
            { label: "Severity", value: first.severity },
            { label: "Casualties", value: first.casualties },
          ]}
        />
      )}
    </Panel>
  );
}
