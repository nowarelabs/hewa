"use client";

import type { ReactElement } from "react";
import { AlertTriangle, Car, Clock, Cloud, DollarSign, Heart, MapPin, Shield } from "lucide-react";

import type { PanelProps, ShellIcon } from "@hewa/app-shell";
import {
  CardList,
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { useFilterParam } from "../state/filter";

/**
 * The `alerts` view: every panel the Alerts tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

type Severity = "critical" | "high" | "medium" | "low";
type Category = "security" | "conflict" | "economic" | "weather" | "health" | "traffic";

interface Alert {
  id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  lat: number;
  lng: number;
  county: string;
  raisedAt: string;
}

const ALERTS: Alert[] = [
  {
    id: "1",
    title: "Security alert: suspected militant activity",
    description:
      "Intelligence reports indicate potential militant activity in the Mandera County border region.",
    category: "security",
    severity: "critical",
    lat: 4.2312,
    lng: 40.867,
    county: "Mandera",
    raisedAt: "2026-03-26T09:15:00Z",
  },
  {
    id: "2",
    title: "Weather warning: heavy rainfall",
    description:
      "The meteorological department forecasts heavy rains in western Kenya over the next 48 hours.",
    category: "weather",
    severity: "high",
    lat: 0.5634,
    lng: 34.7518,
    county: "Kakamega",
    raisedAt: "2026-03-26T08:00:00Z",
  },
  {
    id: "3",
    title: "Health alert: disease outbreak",
    description:
      "Confirmed cases of cholera reported in Homa Bay County. Health officials on high alert.",
    category: "health",
    severity: "high",
    lat: -0.5273,
    lng: 34.4571,
    county: "Homa Bay",
    raisedAt: "2026-03-26T07:30:00Z",
  },
  {
    id: "4",
    title: "Traffic advisory: road closure",
    description:
      "The Mombasa–Nairobi highway is partially closed following an accident. Expect delays.",
    category: "traffic",
    severity: "medium",
    lat: -1.1569,
    lng: 37.0742,
    county: "Machakos",
    raisedAt: "2026-03-26T06:45:00Z",
  },
  {
    id: "5",
    title: "Economic alert: currency fluctuation",
    description: "KES is volatile against major currencies. Markets are reacting to global events.",
    category: "economic",
    severity: "medium",
    lat: -1.2921,
    lng: 36.8219,
    county: "Nairobi",
    raisedAt: "2026-03-26T06:00:00Z",
  },
  {
    id: "6",
    title: "Security alert: armed robbery",
    description: "Multiple reports of armed robbery along the Nairobi–Nakuru corridor.",
    category: "security",
    severity: "medium",
    lat: -0.4581,
    lng: 36.0527,
    county: "Nakuru",
    raisedAt: "2026-03-25T23:00:00Z",
  },
  {
    id: "7",
    title: "Weather advisory: high winds",
    description:
      "Strong winds expected in the Turkana region. Residents advised to secure property.",
    category: "weather",
    severity: "low",
    lat: 3.3256,
    lng: 35.5821,
    county: "Turkana",
    raisedAt: "2026-03-25T18:00:00Z",
  },
  {
    id: "8",
    title: "Conflict warning: tensions rising",
    description: "Increased tensions reported between communities in Marsabit. Monitor closely.",
    category: "conflict",
    severity: "high",
    lat: 2.6845,
    lng: 37.9895,
    county: "Marsabit",
    raisedAt: "2026-03-25T16:30:00Z",
  },
];

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

/**
 * One table of tints, used by the badge, the card, and the rail. It used to be
 * two tables, one per theme, each with a fallback that nothing ever hit, which
 * is six more strings than the four severities have states.
 */
const SEVERITY_TINT: Record<Severity, string> = {
  critical: "text-red-400 bg-red-500/15 border-red-500/30",
  high: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  medium: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  low: "text-green-400 bg-green-500/15 border-green-500/30",
};

const CATEGORY_ICON: Record<Category, ShellIcon> = {
  security: Shield,
  conflict: AlertTriangle,
  economic: DollarSign,
  weather: Cloud,
  health: Heart,
  traffic: Car,
};

const CATEGORY_TINT: Record<Category, string> = {
  security: "text-red-400",
  conflict: "text-orange-400",
  economic: "text-yellow-400",
  weather: "text-blue-400",
  health: "text-green-400",
  traffic: "text-purple-400",
};

export function AlertRailPanel({ item }: PanelProps): ReactElement {
  const severity = SEVERITIES.find((entry) => entry === item) ?? null;
  const shown = severity === null ? ALERTS : ALERTS.filter((alert) => alert.severity === severity);
  const title =
    severity === null
      ? "All alerts"
      : `${severity.charAt(0).toUpperCase()}${severity.slice(1)} alerts`;

  return (
    <Panel title={title}>
      {shown.length === 0 ? (
        <Empty>No {severity ?? ""} priority alerts right now</Empty>
      ) : (
        <CardList
          items={shown.map((alert) => ({
            id: alert.id,
            title: alert.title,
            detail: `${alert.county} · ${alert.severity}`,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every alert, filtered by severity.
 *
 * The bar above this counted the alerts per severity and did nothing with the
 * count. It is the same chips now, as toggles, because the only reason to read
 * "High: 3" is to go and look at the three high alerts.
 */
export function AlertsFeed(): ReactElement {
  const severities = useFilterParam("alerts");
  const shown = visibleBy(ALERTS, (alert) => alert.severity, severities.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <h1 className="text-lg font-semibold text-ink">Alerts</h1>
        <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
          {ALERTS.length} alerts
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(ALERTS, (alert) => alert.severity, {
          keys: SEVERITIES,
          tint: (severity) => SEVERITY_TINT[severity],
        })}
        filter={{
          label: "Filter by severity",
          selected: severities.selected,
          onToggle: severities.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          // A filter can exclude everything, and a panel that renders an empty
          // scroll area gives the operator nothing to tell that from a feed
          // that failed.
          <Empty>No alerts match these severities</Empty>
        ) : null}
        {shown.map((alert) => {
          const CategoryIcon = CATEGORY_ICON[alert.category];
          return (
            <article
              key={alert.id}
              data-row={alert.id}
              className={`rounded-lg border p-4 ${SEVERITY_TINT[alert.severity]}`}
            >
              <div className="flex items-start gap-3">
                <CategoryIcon className={`mt-0.5 h-5 w-5 ${CATEGORY_TINT[alert.category]}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h2 className="font-medium text-ink">{alert.title}</h2>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-xs ${SEVERITY_TINT[alert.severity]}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-ink-muted">{alert.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                    <span className={`flex items-center gap-1 ${CATEGORY_TINT[alert.category]}`}>
                      <CategoryIcon className="h-3 w-3" />
                      {alert.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {alert.county}
                    </span>
                    <span className="font-mono">
                      {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.raisedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function AlertDetailsPanel(): ReactElement {
  const first = ALERTS[0];
  return (
    <Panel title="Alert details">
      {first === undefined ? (
        <Empty>Select an alert</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Title", value: first.title },
            { label: "County", value: first.county },
            { label: "Severity", value: first.severity },
            {
              label: "Raised",
              value: new Date(first.raisedAt).toLocaleString(),
            },
          ]}
        />
      )}
    </Panel>
  );
}
