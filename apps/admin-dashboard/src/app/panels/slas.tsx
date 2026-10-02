"use client";

import type { ReactElement } from "react";
import { AlertTriangle, Coins, FileCheck2 } from "lucide-react";
import {
  SLA_STATE_TITLES,
  creditablePoints,
  formatBps,
  slaShortfallBps,
  type SlaState,
} from "@hewa/marketplace-types";
import type { SlaMonitor, SlaRisk } from "@hewa/console-types";

import { useAtRisk, useCommitments, useCredits } from "../data/slas";
import { useFilterParam } from "../state/filter";
import type { SectionStatus } from "../state/query";
import { Empty, KeyValues, Panel, emptyMessage, summaryCounts, visibleBy } from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import { RecordEditor, asWrite, editorIdField, type FieldSpec, useRecordWrite } from "../ui/editor";
import { createMonitor, patchMonitor } from "../mutations/monitors";

/**
 * The `slas` view's panels: three per section, and the middle column of each.
 *
 * Three sections over one body of data, and the distinction is what each one adds.
 * `commitments` is the book: every monitored commitment with what it promised and
 * what it delivered. `at_risk` is the same rows with the *gap* and its **trend** —
 * a commitment two basis points under target and closing is a different problem from
 * one two under and widening, and a table of both sorted by gap puts the closing one
 * first. `credits` is what the gap is worth, and it travels as points and an exact
 * rate rather than as money, because this service holds no bills to apply the rate
 * to.
 *
 * All three narrow by state, in the left column rather than under the heading. The
 * vocabulary is the same three members, so the column reads the same way in all three
 * sections, and `meta.groups` names all three rather than only the states currently
 * held — which is what keeps a "Breached" toggle there during a good week.
 */

/**
 * The exact credit rate, written as the fraction it is.
 *
 * `1 / 20` rather than `5%` because the rate is a fraction of somebody else's bill
 * and the panel is not that somebody. A reader checking a credit against an invoice
 * needs the two numbers they will divide, not this panel's rendering of one of them.
 */
function creditRate(numerator: number, denominator: number): string {
  return `${numerator} / ${denominator}`;
}

function StateScope({
  rows,
  groups,
  status,
  param,
  noun,
}: {
  rows: readonly { readonly state: SlaState }[];
  groups: readonly SlaState[];
  status: SectionStatus;
  param: string;
  noun: string;
}): ReactElement {
  const filter = useFilterParam(param);

  return (
    <ScopePanel
      label="Filter by state"
      noun={noun}
      status={status}
      items={summaryCounts(rows, (row) => row.state, {
        keys: groups,
        label: (state) => `${SLA_STATE_TITLES[state]} ${noun}`,
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/** `slas/commitments`, left column: the three states, all of them present. */
export function CommitmentsScope(): ReactElement {
  const { rows, groups, status } = useCommitments();
  return (
    <StateScope
      rows={rows}
      groups={groups}
      status={status}
      param="slas-commitments"
      noun="commitments"
    />
  );
}

/** `slas/at_risk`, left column: the same three states, over commitments again. */
export function AtRiskScope(): ReactElement {
  const { rows, groups, status } = useAtRisk();
  return (
    <StateScope
      rows={rows}
      groups={groups}
      status={status}
      param="slas-at-risk"
      noun="commitments"
    />
  );
}

/** `slas/credits`, left column. */
export function CreditsScope(): ReactElement {
  const { rows, groups, status } = useCredits();
  return (
    <StateScope rows={rows} groups={groups} status={status} param="slas-credits" noun="credits" />
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
  return <Empty>{emptyMessage({ status, filtered, noun, filter: "these states" })}</Empty>;
}

/** `slas/commitments`, middle column: every monitored commitment. */
export function CommitmentsPanel(): ReactElement {
  const { rows, status } = useCommitments();
  const filter = useFilterParam("slas-commitments");
  const shown = visibleBy(rows, (row) => row.state, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <FileCheck2 className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Commitments</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} commitments
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="commitments" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Node</th>
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Actual</th>
                <th className="py-1 text-right font-medium">Shortfall</th>
                <th className="py-1 text-right font-medium">Loss</th>
                <th className="py-1 text-right font-medium">p95</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.account}</td>
                  <td className="py-1">{row.nodeName}</td>
                  <td className="py-1">{row.provider}</td>
                  <td className="py-1">{SLA_STATE_TITLES[row.state]}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.sla.targetBps)}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.sla.actualBps)}</td>
                  <td className="py-1 text-right tabular-nums">{Shortfall(row)}</td>
                  <td className="py-1 text-right tabular-nums">{formatPpm(row.packetLossPpm)}</td>
                  <td className="py-1 text-right tabular-nums">{row.latencyP95Ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Parts per million as the percentage an operator reads, to two decimals. */
function formatPpm(ppm: number): string {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

/** The gap against target, or a zero rather than the word "none". */
function Shortfall(row: SlaMonitor | SlaRisk): string {
  return formatBps(slaShortfallBps(row.sla));
}

/**
 * `slas/at_risk`, middle column: the gaps, sorted by how fast they are closing.
 *
 * Two gap columns rather than one, because the section's question is "which of these
 * gets worse". `shortfallBps` is the size of the gap and `trendBps` is its movement
 * over the window — both signed whole numbers, and the rows arrive ordered so that
 * the widening ones are not below the closing ones regardless of how large the gap
 * is. A panel that re-sorted by shortfall would put the commitment that is recovering
 * at the top.
 */
export function AtRiskPanel(): ReactElement {
  const { rows, status } = useAtRisk();
  const filter = useFilterParam("slas-at-risk");
  const shown = visibleBy(rows, (row) => row.state, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <AlertTriangle className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">At risk</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} commitments
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty
            status={status}
            filtered={filter.selected.length > 0}
            noun="at-risk commitments"
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Node</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Actual</th>
                <th className="py-1 text-right font-medium">Gap</th>
                <th className="py-1 text-right font-medium">Trend</th>
                <th className="py-1 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.account}</td>
                  <td className="py-1">{row.nodeName}</td>
                  <td className="py-1">{SLA_STATE_TITLES[row.state]}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.sla.targetBps)}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.sla.actualBps)}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.shortfallBps)}</td>
                  <td className="py-1 text-right tabular-nums">{signedBps(row.trendBps)}</td>
                  <td className="py-1 text-right tabular-nums">{creditablePoints(row.sla)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * A signed basis-point figure, with its sign written out.
 *
 * `+0.50%` against `-0.25%`, because the two numbers are the section's subject: a
 * gap that is closing is a fact about the gap, and dropping the sign would leave a
 * reader comparing magnitudes while believing they are comparing directions.
 */
function signedBps(bps: number): string {
  if (bps === 0) return formatBps(0);
  return `${bps > 0 ? "+" : ""}${formatBps(Math.abs(bps))}`;
}

/** `slas/at_risk`, right column: one commitment's gap and its movement. */
export function AtRiskDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useAtRisk();
  const row = rows.find((candidate) => candidate.id === section) ?? rows[0];

  return (
    <Panel title="At-risk commitment">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "at-risk commitments" })
            : "Nothing is at risk"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Account", value: row.account },
            { label: "Node", value: `${row.nodeName} (${row.nodeId})` },
            { label: "Provider", value: row.provider },
            { label: "State", value: SLA_STATE_TITLES[row.state] },
            { label: "Target", value: formatBps(row.sla.targetBps) },
            { label: "Actual", value: formatBps(row.sla.actualBps) },
            { label: "Gap", value: formatBps(row.shortfallBps) },
            { label: "Trend", value: signedBps(row.trendBps) },
            { label: "Creditable points", value: creditablePoints(row.sla) },
            {
              label: "Credit rate",
              value: creditRate(row.sla.creditNumerator, row.sla.creditDenominator),
            },
            { label: "Measured at", value: new Date(row.measuredAt).toLocaleString() },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `slas/credits`, middle column: what each gap is worth.
 *
 * The money columns are gone and deliberately so. A credit is a rate against a bill
 * that lives in the settlement view, so this section carries the two numbers a reader
 * needs in order to compute it themselves — the creditable points and the exact rate —
 * rather than a figure this panel invented by multiplying one by the other. The
 * points column is the floor of the gap in whole percentage points, which is why a
 * two-basis-point gap shows zero: not because the credit is free, but because the
 * charging unit has not been reached.
 */
export function CreditsPanel(): ReactElement {
  const { rows, status } = useCredits();
  const filter = useFilterParam("slas-credits");
  const shown = visibleBy(rows, (row) => row.state, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Coins className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Credits</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} credits
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="credits" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Commitment</th>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Node</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Actual</th>
                <th className="py-1 text-right font-medium">Points</th>
                <th className="py-1 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.commitmentId}
                  data-row={row.commitmentId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1 font-mono">{row.commitmentId}</td>
                  <td className="py-1">{row.account}</td>
                  <td className="py-1">{row.nodeName}</td>
                  <td className="py-1">{SLA_STATE_TITLES[row.state]}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.targetBps)}</td>
                  <td className="py-1 text-right tabular-nums">{formatBps(row.actualBps)}</td>
                  <td className="py-1 text-right tabular-nums">{row.creditablePoints}</td>
                  <td className="py-1 text-right tabular-nums">
                    {creditRate(row.creditNumerator, row.creditDenominator)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `slas/credits`, right column: one credit's arithmetic. */
export function CreditsDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useCredits();
  const row = rows.find((candidate) => candidate.commitmentId === section) ?? rows[0];

  return (
    <Panel title="Credit">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "credits" })
            : "Select a credit to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Commitment", value: row.commitmentId },
            { label: "Account", value: row.account },
            { label: "Node", value: row.nodeName },
            { label: "Provider", value: row.provider },
            { label: "State", value: SLA_STATE_TITLES[row.state] },
            { label: "Target", value: formatBps(row.targetBps) },
            { label: "Actual", value: formatBps(row.actualBps) },
            { label: "Creditable points", value: row.creditablePoints },
            { label: "Credit rate", value: creditRate(row.creditNumerator, row.creditDenominator) },
            { label: "Measured at", value: new Date(row.measuredAt).toLocaleString() },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `slas/commitments`, right column: the commitment this section is about, editable.
 *
 * The four commitment figures are in basis points and the credit is an exact
 * fraction, because those are the columns. A field showing `99.95` for `9995` would
 * have to multiply by 100 on the way out and divide by 100 on the way back, and
 * `99.95 * 100` is not always `9995` — which is a figure that agrees with the
 * database most of the time, which is worse.
 *
 * `state` is not a field, and that is the point of this panel being four inputs
 * smaller than the details panel it replaces. The service derives it from these
 * numbers, so a form that could set it could declare a commitment compliant by
 * typing a word — and the derived state is what the credit and the alert both rest
 * on. It is shown above the form instead, read-only, so the operator can see what
 * their numbers produced.
 */
export function MonitorEditor({ section }: { section: string | null }): ReactElement {
  const { rows, refetch } = useCommitments();
  const write = useRecordWrite<SlaMonitor>({
    rows,
    selected: section,
    keyOf: (row) => row.id,
    create: (body) => createMonitor(asWrite(body)),
    save: (id, body) => patchMonitor(id, asWrite(body)),
    onSaved: refetch,
  });

  const row = rows.find((candidate) => candidate.id === section) ?? rows[0];

  return (
    <RecordEditor
      noun="commitment"
      fields={MONITOR_FIELDS}
      write={write}
      submitLabel="Save commitment"
      summary={
        row === undefined ? (
          <p className="text-sm text-ink-muted">
            No commitment loaded. Pick one in the list, or start a new one.
          </p>
        ) : (
          <KeyValues
            rows={[
              { label: "State", value: SLA_STATE_TITLES[row.state] },
              { label: "Shortfall", value: `${slaShortfallBps(row.sla)} bps` },
              { label: "Creditable points", value: creditablePoints(row.sla) },
            ]}
          />
        )
      }
    />
  );
}

/**
 * Every column `MonitorWrite` accepts, which is the record minus the derived state.
 *
 * `nodeName` beside `nodeId` is the contract's, not this form's: the service checks
 * the pair agrees, so both are editable and a mismatch is refused rather than
 * silently corrected — a commitment whose row says one thing and whose name says
 * another is the ambiguity the check exists to stop.
 */
export const MONITOR_FIELDS: readonly FieldSpec[] = [
  editorIdField("monitors"),
  { name: "account", label: "Account", kind: "text" },
  { name: "nodeId", label: "Node id", kind: "text" },
  { name: "nodeName", label: "Node name", kind: "text" },
  { name: "provider", label: "Provider", kind: "text" },
  {
    name: "sla.targetBps",
    label: "Target",
    kind: "number",
    min: 0,
    max: 10_000,
    step: 1,
    hint: "basis points: 9995 is 99.95%",
  },
  {
    name: "sla.actualBps",
    label: "Actual",
    kind: "number",
    min: 0,
    max: 10_000,
    step: 1,
    hint: "basis points",
  },
  {
    name: "sla.creditNumerator",
    label: "Credit numerator",
    kind: "number",
    min: 0,
    step: 1,
    hint: "credit per point of shortfall, as a fraction of the charge",
  },
  {
    name: "sla.creditDenominator",
    label: "Credit denominator",
    kind: "number",
    min: 1,
    step: 1,
    hint: "1 / 20 is 5% of the charge per point",
  },
  {
    name: "packetLossPpm",
    label: "Packet loss",
    kind: "number",
    min: 0,
    step: 1,
    hint: "parts per million",
  },
  {
    name: "latencyP95Ms",
    label: "Latency p95",
    kind: "number",
    min: 0,
    step: 1,
    hint: "milliseconds",
  },
  { name: "measuredAt", label: "Measured at", kind: "instant" },
];
