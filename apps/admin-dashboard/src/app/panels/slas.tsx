"use client";

import type { ReactElement } from "react";
import { ShieldCheck } from "lucide-react";
import { SLA_STATE_TITLES, formatBps } from "@hewa/marketplace-types";

import type { PanelProps } from "@hewa/app-shell";
import type { SlaMonitor, SlaState } from "../data/slas";
import { useSlas } from "../data/slas";
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
 * The `slas` view: every panel the SLAs tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks the state, the middle column lists the
 * monitored commitments, and the right column describes one of them.
 */

/** How a state is drawn, in one table rather than one per panel. */
const STATE_TINT: Record<SlaState, string> = {
  compliant: "text-green-400 bg-green-500/15 border-green-500/30",
  at_risk: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  breached: "text-red-400 bg-red-500/15 border-red-500/30",
};

/** The left column: the commitments in one state, or all of them. */
export function SlaRailPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useSlas();
  const state = item === null || item === "all" ? null : item;
  const shown = state === null ? rows : rows.filter((row) => row.state === state);

  return (
    <Panel title={state === null ? "All commitments" : state}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: state === null ? "commitments" : `${state} commitments`,
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((row) => ({
            id: row.id,
            title: row.nodeName,
            detail: `${row.account} · ${formatBps(row.sla.actualBps)} of ${formatBps(row.sla.targetBps)}`,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every monitored commitment, filtered by state.
 *
 * The state on each row is the one the service computed and sent. It is not
 * recomputed here from `targetBps` and `actualBps`, because that comparison is
 * what a settlement run uses to decide whether a credit is owed: two copies of
 * one rule is how a commitment reads "breached" on a screen and never appears on
 * an invoice.
 */
export function SlaMonitorList(): ReactElement {
  const { rows, groups, status } = useSlas();
  const filter = useFilterParam("slas");
  const shown = visibleBy(rows, (row) => row.state, filter.selected as readonly SlaState[]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Service levels</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} commitments
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (row) => row.state, {
          keys: groups,
          label: (state) => SLA_STATE_TITLES[state],
          tint: (state) => STATE_TINT[state],
        })}
        filter={{
          label: "Filter by state",
          selected: filter.selected,
          onToggle: filter.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "commitments",
              filter: "these states",
            })}
          </Empty>
        ) : (
          shown.map((row) => <SlaCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function SlaCard({ row }: { row: SlaMonitor }): ReactElement {
  return (
    <article data-row={row.id} className="rounded-lg border border-line bg-surface-raised p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-medium text-ink">{row.nodeName}</h2>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${STATE_TINT[row.state]}`}>
          {row.state}
        </span>
      </div>
      <p className="mb-2 text-sm text-ink-muted">
        {row.account} · {row.provider}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
        <span className="tabular-nums text-ink">{formatBps(row.sla.actualBps)}</span>
        <span className="tabular-nums">target {formatBps(row.sla.targetBps)}</span>
        <span className="tabular-nums">{row.packetLossPpm.toLocaleString()} ppm loss</span>
        <span className="tabular-nums">{row.latencyP95Ms} ms p95</span>
      </div>
    </article>
  );
}

/**
 * The right column: one commitment, and the credit its shortfall would produce.
 *
 * `formatBps` is used for the availabilities rather than a local percentage
 * template, because the numbers arrive in basis points and dividing by 100 in two
 * places is how a panel and an invoice disagree about the last decimal.
 */
export function SlaDetailsPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useSlas();
  const row = rows.find((candidate) => candidate.id === item) ?? rows[0];

  return (
    <Panel title="Commitment details">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "commitments" })
            : "Select a commitment to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Node", value: row.nodeName },
            { label: "Account", value: row.account },
            { label: "Provider", value: row.provider },
            { label: "State", value: row.state },
            { label: "Target", value: formatBps(row.sla.targetBps) },
            { label: "Delivered", value: formatBps(row.sla.actualBps) },
            {
              label: "Credit rate",
              value: `${row.sla.creditNumerator}/${row.sla.creditDenominator} per point`,
            },
            { label: "Packet loss", value: `${row.packetLossPpm.toLocaleString()} ppm` },
            { label: "Latency p95", value: `${row.latencyP95Ms} ms` },
            { label: "Measured", value: new Date(row.measuredAt).toLocaleString() },
          ]}
        />
      )}
    </Panel>
  );
}
