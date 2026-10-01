"use client";

import type { ReactElement } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Cpu,
  Info,
  Receipt,
  ServerCrash,
  Shield,
} from "lucide-react";

import { ALERT_SEVERITY_TITLES } from "@hewa/console-types";

import type { PanelProps, ShellIcon } from "@hewa/app-shell";
import type { Alert, AlertCategory, AlertSeverity } from "../data/alerts";
import { useAlerts } from "../data/alerts";
import { useFilterParam } from "../state/filter";
import {
  CardList,
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";

/**
 * The `alerts` view: every panel the Alerts tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks the severity, the middle column lists the
 * alerts, and the right column describes the one the operator is about to act on.
 */

/** One table of tints, used by the badge, the card, and the summary chips. */
const SEVERITY_TINT: Record<AlertSeverity, string> = {
  critical: "text-red-400 bg-red-500/15 border-red-500/30",
  high: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  medium: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  low: "text-green-400 bg-green-500/15 border-green-500/30",
};

const SEVERITY_ICON: Record<AlertSeverity, ShellIcon> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: Bell,
};

const CATEGORY_ICON: Record<AlertCategory, ShellIcon> = {
  sla: Shield,
  capacity: Cpu,
  outage: ServerCrash,
  billing: Receipt,
  security: Shield,
};

const CATEGORY_TINT: Record<AlertCategory, string> = {
  sla: "text-cyan-400",
  capacity: "text-blue-400",
  outage: "text-red-400",
  billing: "text-yellow-400",
  security: "text-orange-400",
};

/** The left column: the alerts of one severity, or all of them. */
export function AlertRailPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useAlerts();
  const severity = item === null || item === "all" ? null : item;
  const shown = severity === null ? rows : rows.filter((alert) => alert.severity === severity);
  const title = severity === null ? "All alerts" : `${severity} alerts`;

  return (
    <Panel title={title}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: severity === null ? "alerts" : `${severity} alerts`,
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((alert) => ({
            id: alert.id,
            title: alert.title,
            detail: `${alert.entityLabel} · ${alert.severity}`,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every alert, filtered by the severity chips above it.
 *
 * An alert names the thing it is about, so the panel can label it without joining
 * across views: `entityLabel` arrives with the record precisely so a panel
 * showing an alert does not also have to fetch the node or the settlement it
 * refers to.
 */
export function AlertsFeed(): ReactElement {
  const { rows, groups, status } = useAlerts();
  const filter = useFilterParam("alerts");
  const shown = visibleBy(
    rows,
    (alert) => alert.severity,
    filter.selected as readonly AlertSeverity[],
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <h1 className="text-lg font-semibold text-ink">Alerts</h1>
        <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
          {rows.length} alerts
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (alert) => alert.severity, {
          // The severities the service names, not a list kept here. Every severity
          // it can hold gets a chip, including one nothing is on at the moment —
          // which is what stops the bar losing a filter as the data moves.
          keys: groups,
          label: (severity) => ALERT_SEVERITY_TITLES[severity],
          tint: (severity) => SEVERITY_TINT[severity],
        })}
        filter={{
          label: "Filter by severity",
          selected: filter.selected,
          onToggle: filter.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          // A filter can exclude everything, and a panel that renders an empty
          // scroll area gives the operator nothing to tell that from a feed that
          // failed.
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "alerts",
              filter: "these severities",
            })}
          </Empty>
        ) : (
          shown.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }): ReactElement {
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
            <span>{alert.entityLabel}</span>
            <span className="tabular-nums">{alert.impactedGbps} Gbps affected</span>
            <span className="tabular-nums">{alert.affectedSlas} commitments</span>
            <span>{new Date(alert.raisedAt).toLocaleString()}</span>
          </div>
          {alert.automatedAction === null ? null : (
            <p className="mt-2 text-xs text-ink-muted">Automation: {alert.automatedAction}</p>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * The right column: the entity an alert is about, and what is already done.
 *
 * `automatedAction` renders as "None recorded" rather than a dash, because "we
 * did not act" and "we acted and the note was blank" are different facts and only
 * the first of them is a dash.
 */
export function AlertDetailsPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useAlerts();
  const alert = rows.find((candidate) => candidate.id === item) ?? rows[0];
  const SeverityIcon = alert === undefined ? Bell : SEVERITY_ICON[alert.severity];

  return (
    <Panel title="Alert details">
      {alert === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "alerts" })
            : "Select an alert to view details"}
        </Empty>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SeverityIcon className={`h-4 w-4 ${SEVERITY_TINT[alert.severity].split(" ")[0]}`} />
            <span className="text-sm font-medium text-ink">{alert.entityLabel}</span>
          </div>
          <KeyValues
            rows={[
              { label: "Severity", value: alert.severity },
              { label: "Category", value: alert.category },
              { label: "Entity", value: `${alert.entityLabel} (${alert.entityId})` },
              { label: "Provider", value: alert.provider },
              { label: "Location", value: alert.city },
              { label: "Impacted", value: `${alert.impactedGbps} Gbps` },
              { label: "Commitments", value: alert.affectedSlas },
              { label: "Raised", value: new Date(alert.raisedAt).toLocaleString() },
              { label: "Automated action", value: alert.automatedAction ?? "None recorded" },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
