"use client";

import type { ReactElement } from "react";
import { AlertTriangle, Coins, TrendingDown } from "lucide-react";
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_TITLES,
  ALERT_SEVERITIES,
  ALERT_SEVERITY_TITLES,
  type Alert,
  type AlertSeverity,
  type CapacityPressure,
  type OutageGroup,
  type SecurityEvent,
} from "@hewa/console-types";
import { useAlertFeed, useCapacityPressure, useOutages, useSecurityEvents } from "../data/alerts";
import { useFilterParam } from "../state/filter";
import type { SectionStatus } from "../state/query";
import { Empty, KeyValues, Panel, emptyMessage, summaryCounts, visibleBy } from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import { RecordEditor, asWrite, editorIdField, type FieldSpec, useRecordWrite } from "../ui/editor";
import { createAlert, patchAlert } from "../mutations/alerts";

/**
 * The `alerts` view's panels: three per section, and the middle column of each.
 *
 * Four sections and four different row shapes. `feed` is one row per alert; the other
 * three are one row per *thing* — per cable, per node, per provider edge — because the
 * repetition they collapse is what hid the critical alert on row two of four identical
 * rows. The count column on those three is the figure that collapse exists to produce,
 * so it is a column and not a detail line.
 *
 * All four narrow by severity, and that narrowing is the left column rather than a
 * strip under the heading: severity is the triage control on every one of them, and
 * the heading's job is to say what the section is. The categories are shown on the
 * feed's rows and never turned into a filter: "who gets paged" is a rota question and
 * the section is already the answer to it.
 */

/**
 * The severity vocabulary, over whichever severity column the rows carry.
 *
 * The feed's rows are alerts and their column is `severity`; the other three are
 * groups and their column is `worstSeverity`, because a group has no severity of
 * its own — it has the worst of its members'. The key is passed rather than
 * hard-coded so this is one column over four sections instead of four, and so the
 * caller cannot quietly filter the feed by a column its rows do not have.
 */
function SeverityScope<TRow extends object>({
  rows,
  groups,
  status,
  param,
  noun,
  severity,
}: {
  rows: readonly TRow[];
  groups: readonly AlertSeverity[];
  status: SectionStatus;
  param: string;
  noun: string;
  severity: (row: TRow) => AlertSeverity;
}): ReactElement {
  const filter = useFilterParam(param);

  return (
    <ScopePanel
      label="Filter by severity"
      noun={noun}
      status={status}
      items={summaryCounts(rows, severity, {
        keys: groups,
        label: (severity) => ALERT_SEVERITY_TITLES[severity],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/** `alerts/feed`, left column: the four severities, all of them present at zero. */
export function FeedScope(): ReactElement {
  const { rows, groups, status } = useAlertFeed();
  return (
    <SeverityScope
      rows={rows}
      groups={groups}
      status={status}
      param="alerts-feed"
      noun="alerts"
      severity={(row) => row.severity}
    />
  );
}

/** `alerts/outages`, left column. */
export function OutagesScope(): ReactElement {
  const { rows, groups, status } = useOutages();
  return (
    <SeverityScope
      rows={rows}
      groups={groups}
      status={status}
      param="alerts-outages"
      noun="outages"
      severity={(row) => row.worstSeverity}
    />
  );
}

/** `alerts/capacity`, left column. */
export function CapacityScope(): ReactElement {
  const { rows, groups, status } = useCapacityPressure();
  return (
    <SeverityScope
      rows={rows}
      groups={groups}
      status={status}
      param="alerts-capacity"
      noun="capacity alerts"
      severity={(row) => row.worstSeverity}
    />
  );
}

/** `alerts/security`, left column. */
export function SecurityScope(): ReactElement {
  const { rows, groups, status } = useSecurityEvents();
  return (
    <SeverityScope
      rows={rows}
      groups={groups}
      status={status}
      param="alerts-security"
      noun="security events"
      severity={(row) => row.worstSeverity}
    />
  );
}

function ListEmpty({
  status,
  filtered,
  noun,
}: {
  status: "pending" | "failed" | "ready";
  filtered: boolean;
  noun: string;
}): ReactElement {
  return <Empty>{emptyMessage({ status, filtered, noun, filter: "these severities" })}</Empty>;
}

/** `alerts/feed`, middle column: every alert, worst and newest first. */
export function FeedPanel(): ReactElement {
  const { rows, status } = useAlertFeed();
  const filter = useFilterParam("alerts-feed");
  const shown = visibleBy(rows, (row) => row.severity, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <AlertTriangle className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Alert feed</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} alerts
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="alerts" />
        ) : (
          shown.map((row) => <AlertCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function AlertCard({ row }: { row: Alert }): ReactElement {
  return (
    <article data-row={row.id} className="rounded-lg border border-line bg-surface-raised p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-medium text-ink">{row.title}</h2>
        <span className="shrink-0 rounded border border-line px-2 py-0.5 text-xs text-ink-muted">
          {ALERT_SEVERITY_TITLES[row.severity]}
        </span>
      </div>
      <p className="mb-2 text-sm text-ink-muted">{row.description}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
        <span>{ALERT_CATEGORY_TITLES[row.category]}</span>
        <span>{row.entityLabel}</span>
        <span className="tabular-nums">{row.impactedGbps} Gbps affected</span>
        <span className="tabular-nums">{row.affectedSlas} commitments</span>
        <span>{new Date(row.raisedAt).toLocaleString()}</span>
      </div>
      {row.automatedAction === null ? null : (
        <p className="mt-2 text-xs text-ink-muted">{row.automatedAction}</p>
      )}
    </article>
  );
}

/**
 * `alerts/outages`, middle column: one row per thing that broke.
 *
 * Ordered by the service by worst severity first, so the table is already in triage
 * order and this panel does not re-sort it. `alertCount` is a column because it is the
 * figure the grouping exists to produce: one cable down and four alerts about it is
 * one row saying four.
 */
export function OutagesPanel(): ReactElement {
  const { rows, status } = useOutages();
  const filter = useFilterParam("alerts-outages");
  const shown = visibleBy(rows, (row) => row.worstSeverity, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <TrendingDown className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Outages</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} outages
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="outages" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Entity</th>
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 font-medium">Worst</th>
                <th className="py-1 text-right font-medium">Alerts</th>
                <th className="py-1 text-right font-medium">Impacted</th>
                <th className="py-1 text-right font-medium">Commitments</th>
                <th className="py-1 font-medium">Last raised</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.entityId}
                  data-row={row.entityId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.entityLabel}</td>
                  <td className="py-1">{row.provider}</td>
                  <td className="py-1">{ALERT_SEVERITY_TITLES[row.worstSeverity]}</td>
                  <td className="py-1 text-right tabular-nums">{row.alertCount}</td>
                  <td className="py-1 text-right tabular-nums">{row.impactedGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">{row.affectedSlas}</td>
                  <td className="py-1">{new Date(row.lastRaisedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `alerts/outages`, right column: one outage's group. */
export function OutagesDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useOutages();
  const row = rows.find((candidate) => candidate.entityId === section) ?? rows[0];

  return (
    <Panel title="Outage">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "outages" })
            : "Select an outage to view details"}
        </Empty>
      ) : (
        <OutageFigures row={row} />
      )}
    </Panel>
  );
}

/** One outage's group, shared by the outage columns. */
export function OutageFigures({ row }: { row: OutageGroup }): ReactElement {
  return (
    <KeyValues
      rows={[
        { label: "Entity", value: row.entityLabel },
        { label: "Provider", value: row.provider },
        { label: "Location", value: row.city },
        { label: "Worst severity", value: ALERT_SEVERITY_TITLES[row.worstSeverity] },
        { label: "Alerts", value: row.alertCount },
        { label: "Impacted", value: `${row.impactedGbps} Gbps` },
        { label: "Commitments", value: row.affectedSlas },
        { label: "First raised", value: new Date(row.firstRaisedAt).toLocaleString() },
        { label: "Last raised", value: new Date(row.lastRaisedAt).toLocaleString() },
        { label: "Automation", value: row.automatedAction ?? "Nothing done" },
      ]}
    />
  );
}

/**
 * `alerts/capacity`, middle column: alerts about running out, beside the headroom.
 *
 * `capacityGbps` and `headroomGbps` are `null` for an alert about something that is
 * not one of our nodes, and this table renders that as a dash rather than as `0`. A
 * zero would put a row with unknown headroom into a column of nodes with room, and
 * the next order would be placed on the strength of it.
 */
export function CapacityPanel(): ReactElement {
  const { rows, status } = useCapacityPressure();
  const filter = useFilterParam("alerts-capacity");
  const shown = visibleBy(rows, (row) => row.worstSeverity, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <AlertTriangle className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Capacity</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} alerts
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="capacity alerts" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Entity</th>
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 font-medium">Worst</th>
                <th className="py-1 text-right font-medium">Capacity</th>
                <th className="py-1 text-right font-medium">Headroom</th>
                <th className="py-1 text-right font-medium">Impacted</th>
                <th className="py-1 font-medium">Raised</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.entityId}
                  data-row={row.entityId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.entityLabel}</td>
                  <td className="py-1">{row.provider}</td>
                  <td className="py-1">{ALERT_SEVERITY_TITLES[row.worstSeverity]}</td>
                  <td className="py-1 text-right tabular-nums">
                    {row.capacityGbps === null ? "—" : `${row.capacityGbps} Gbps`}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {row.headroomGbps === null ? "—" : `${row.headroomGbps} Gbps`}
                  </td>
                  <td className="py-1 text-right tabular-nums">{row.impactedGbps} Gbps</td>
                  <td className="py-1">{new Date(row.lastRaisedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `alerts/capacity`, right column: one node's pressure. */
export function CapacityDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useCapacityPressure();
  const row = rows.find((candidate) => candidate.entityId === section) ?? rows[0];

  return (
    <Panel title="Capacity pressure">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "capacity alerts" })
            : "Select an alert to view details"}
        </Empty>
      ) : (
        <PressureFigures row={row} />
      )}
    </Panel>
  );
}

/** One node's pressure, shared by the capacity columns. */
export function PressureFigures({ row }: { row: CapacityPressure }): ReactElement {
  return (
    <KeyValues
      rows={[
        { label: "Entity", value: row.entityLabel },
        { label: "Provider", value: row.provider },
        { label: "Location", value: row.city },
        { label: "Worst severity", value: ALERT_SEVERITY_TITLES[row.worstSeverity] },
        { label: "Alerts", value: row.alertCount },
        { label: "Capacity", value: row.capacityGbps === null ? "—" : `${row.capacityGbps} Gbps` },
        { label: "Headroom", value: row.headroomGbps === null ? "—" : `${row.headroomGbps} Gbps` },
        { label: "Impacted", value: `${row.impactedGbps} Gbps` },
        { label: "Raised", value: new Date(row.lastRaisedAt).toLocaleString() },
      ]}
    />
  );
}

/**
 * `alerts/security`, middle column: one row per entity that was breached.
 *
 * `eventCount` and `automatedAction` are the two columns that make this section
 * rather than the feed: the count is how big the intrusion was, and the action is
 * whether it has already been answered. A feed of forty rows saying "unauthorised
 * access" answers neither.
 */
export function SecurityPanel(): ReactElement {
  const { rows, status } = useSecurityEvents();
  const filter = useFilterParam("alerts-security");
  const shown = visibleBy(rows, (row) => row.worstSeverity, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Coins className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Security</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} entities
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="security events" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Entity</th>
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 font-medium">Worst</th>
                <th className="py-1 text-right font-medium">Events</th>
                <th className="py-1 font-medium">Automation</th>
                <th className="py-1 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.entityId}
                  data-row={row.entityId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.entityLabel}</td>
                  <td className="py-1">{row.provider}</td>
                  <td className="py-1">{ALERT_SEVERITY_TITLES[row.worstSeverity]}</td>
                  <td className="py-1 text-right tabular-nums">{row.eventCount}</td>
                  <td className="py-1">
                    {row.automatedAction === null ? "Nothing done" : row.automatedAction}
                  </td>
                  <td className="py-1">{new Date(row.lastSeenAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `alerts/security`, right column: one entity's intrusions. */
export function SecurityDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useSecurityEvents();
  const row = rows.find((candidate) => candidate.entityId === section) ?? rows[0];

  return (
    <Panel title="Security event">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "security events" })
            : "Select an entity to view details"}
        </Empty>
      ) : (
        <SecurityFigures row={row} />
      )}
    </Panel>
  );
}

/** One entity's intrusions, shared by the security columns. */
export function SecurityFigures({ row }: { row: SecurityEvent }): ReactElement {
  return (
    <KeyValues
      rows={[
        { label: "Entity", value: row.entityLabel },
        { label: "Provider", value: row.provider },
        { label: "Location", value: row.city },
        { label: "Worst severity", value: ALERT_SEVERITY_TITLES[row.worstSeverity] },
        { label: "Events", value: row.eventCount },
        { label: "Last seen", value: new Date(row.lastSeenAt).toLocaleString() },
        { label: "Automation", value: row.automatedAction ?? "Nothing done" },
      ]}
    />
  );
}

/**
 * `alerts/feed`, right column: the alert this section is about, editable.
 *
 * The form replaces the read-only panel rather than sitting under it, because the
 * two would show the same seven columns twice and the only thing that changed would
 * be that one of them could be typed into. Everything here is `AlertWrite` and
 * nothing else — a column the read side holds that a write does not accept is not
 * sent, and a column the service refuses names itself in the refusal.
 *
 * There is no Delete, and its absence is the contract's: an alert is a record that
 * something happened, and deleting it would remove the fact rather than correct it.
 * A severity that was overstated is a severity that can be changed.
 */
export function AlertEditor({ section }: { section: string | null }): ReactElement {
  const { rows, refetch } = useAlertFeed();
  const write = useRecordWrite<Alert>({
    rows,
    selected: section,
    keyOf: (row) => row.id,
    create: (body) => createAlert(asWrite(body)),
    save: (id, body) => patchAlert(id, asWrite(body)),
    onSaved: refetch,
  });

  return <RecordEditor noun="alert" fields={ALERT_FIELDS} write={write} submitLabel="Save alert" />;
}

/** Every column `AlertWrite` accepts, in the order an operator reads an alert. */
export const ALERT_FIELDS: readonly FieldSpec[] = [
  editorIdField("alerts"),
  { name: "title", label: "Title", kind: "text" },
  { name: "description", label: "Description", kind: "multiline" },
  {
    name: "category",
    label: "Category",
    kind: "select",
    options: ALERT_CATEGORIES.map((value) => ({ value, label: value })),
  },
  {
    name: "severity",
    label: "Severity",
    kind: "select",
    options: ALERT_SEVERITIES.map((value) => ({ value, label: value })),
  },
  { name: "entityId", label: "Entity id", kind: "text" },
  { name: "entityLabel", label: "Entity", kind: "text" },
  { name: "provider", label: "Provider", kind: "text" },
  { name: "city", label: "City", kind: "text" },
  { name: "lat", label: "Latitude", kind: "number", step: 0.0001 },
  { name: "lng", label: "Longitude", kind: "number", step: 0.0001 },
  { name: "impactedGbps", label: "Impacted", kind: "number", step: 0.1, hint: "Gbps" },
  {
    name: "affectedSlas",
    label: "Commitments affected",
    kind: "number",
    step: 1,
    hint: "whole commitments",
  },
  {
    name: "automatedAction",
    label: "Automated action",
    kind: "text",
    nullable: true,
    hint: "empty for an alert nothing acted on",
  },
  { name: "raisedAt", label: "Raised at", kind: "instant" },
];
