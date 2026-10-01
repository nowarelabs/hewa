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
import {
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";

/**
 * The `slas` view's panels: two per section, and the middle column of each.
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
 * Every state vocabulary is the same three members, so the chips read the same way
 * in all three sections. `meta.groups` names all three rather than only the states
 * currently held, which is what keeps a "breached" chip on the bar during a good week.
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

function StateBar({
  rows,
  groups,
  param,
  noun,
}: {
  rows: readonly { readonly state: SlaState }[];
  groups: readonly SlaState[];
  param: string;
  noun: string;
}): ReactElement {
  const filter = useFilterParam(param);

  return (
    <SummaryBar
      items={summaryCounts(rows, (row) => row.state, {
        keys: groups,
        label: (state) => `${SLA_STATE_TITLES[state]} ${noun}`,
      })}
      filter={{
        label: "Filter by state",
        selected: filter.selected,
        onToggle: filter.toggle,
      }}
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
  return <Empty>{emptyMessage({ status, filtered, noun, filter: "these states" })}</Empty>;
}

/** `slas/commitments`, middle column: every monitored commitment. */
export function CommitmentsPanel(): ReactElement {
  const { rows, groups, status } = useCommitments();
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

      <StateBar rows={rows} groups={groups} param="slas-commitments" noun="commitments" />

      <div className="min-h-0 flex-1 overflow-auto p-4">
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

/** `slas/commitments`, right column: one commitment as the service holds it. */
export function CommitmentsDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useCommitments();
  const row = rows.find((candidate) => candidate.id === section) ?? rows[0];

  return (
    <Panel title="Commitment">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "commitments" })
            : "Select a commitment to view details"}
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
            { label: "Shortfall", value: Shortfall(row) },
            { label: "Creditable points", value: creditablePoints(row.sla) },
            {
              label: "Credit rate",
              value: creditRate(row.sla.creditNumerator, row.sla.creditDenominator),
            },
            { label: "Packet loss", value: `${row.packetLossPpm} ppm` },
            { label: "Latency p95", value: `${row.latencyP95Ms} ms` },
            { label: "Measured at", value: new Date(row.measuredAt).toLocaleString() },
          ]}
        />
      )}
    </Panel>
  );
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
  const { rows, groups, status } = useAtRisk();
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

      <StateBar rows={rows} groups={groups} param="slas-at-risk" noun="at risk" />

      <div className="min-h-0 flex-1 overflow-auto p-4">
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
  const { rows, groups, status } = useCredits();
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

      <StateBar rows={rows} groups={groups} param="slas-credits" noun="credits" />

      <div className="min-h-0 flex-1 overflow-auto p-4">
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
