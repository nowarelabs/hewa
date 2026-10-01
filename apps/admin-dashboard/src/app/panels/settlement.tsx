"use client";

import type { ReactElement } from "react";
import { ArrowRightLeft, Clock } from "lucide-react";
import { formatMoney } from "@hewa/marketplace-types";

import { SETTLEMENT_KIND_TITLES } from "@hewa/console-types";

import type { PanelProps } from "@hewa/app-shell";
import type { Settlement, SettlementKind } from "../data/settlement";
import { useSettlements } from "../data/settlement";
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
 * The `settlement` view: every panel the Settlement tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks the kind, the middle column lists the
 * movements, and the right column describes the one that is failing.
 */

/** How a status is drawn, in one table rather than one per panel. */
const STATUS_TINT: Record<Settlement["status"], string> = {
  completed: "text-green-400",
  pending: "text-ink-muted",
  processing: "text-cyan-400",
  failed: "text-red-400",
  reversed: "text-orange-400",
};

/** The left column: the movements of one kind, or all of them. */
export function SettlementRailPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useSettlements();
  const kind = item === null || item === "all" ? null : item;
  const shown = kind === null ? rows : rows.filter((row) => row.kind === kind);

  return (
    <Panel title={kind === null ? "All movements" : kind}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: kind === null ? "movements" : `${kind} movements`,
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((row) => ({
            id: row.id,
            title: `${row.kind} · ${row.batch}`,
            detail: `${formatMoney(row.amount)} · ${row.status}`,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every movement, filtered by kind.
 *
 * Amounts are rendered by the shared `formatMoney` rather than by a local
 * template, because USDC has six decimals and USD two: a formatter that assumed
 * two would show a micro-payment off by four orders of magnitude, and it would
 * be the smallest-looking number on the screen, which is where a mistake survives
 * longest.
 */
export function SettlementFeed(): ReactElement {
  const { rows, groups, status } = useSettlements();
  const filter = useFilterParam("settlement");
  const shown = visibleBy(rows, (row) => row.kind, filter.selected as readonly SettlementKind[]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <ArrowRightLeft className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Settlement</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} movements
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (row) => row.kind, {
          keys: groups,
          // "Payouts" on the chip and `payout` in the query string. The label is
          // a display decision and the key is the row's value, and keeping them
          // apart is what lets the rail be worded for an operator while the
          // filter stays keyed on something the data carries.
          label: (kind) => SETTLEMENT_KIND_TITLES[kind],
        })}
        filter={{
          label: "Filter by kind",
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
              noun: "movements",
              filter: "these kinds",
            })}
          </Empty>
        ) : (
          shown.map((row) => <SettlementCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function SettlementCard({ row }: { row: Settlement }): ReactElement {
  return (
    <article
      data-row={row.id}
      className={`rounded-lg border border-line bg-surface-raised p-4 ${
        row.failureReason === null ? "" : "border-red-500/30"
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-medium text-ink">
          {row.kind} · {row.batch}
        </h2>
        <span
          className={`shrink-0 rounded border border-line px-2 py-0.5 text-xs ${STATUS_TINT[row.status]}`}
        >
          {row.status}
        </span>
      </div>
      <p className="mb-2 text-sm text-ink-muted">{row.counterparty}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
        <span className="tabular-nums text-ink">{formatMoney(row.amount)}</span>
        <span className="tabular-nums">Fee {formatMoney(row.fee)}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(row.occurredAt).toLocaleString()}
        </span>
      </div>
      {row.failureReason === null ? null : (
        <p className="mt-2 text-xs text-red-400">{row.failureReason}</p>
      )}
    </article>
  );
}

/**
 * The right column: what stopped the movement from clearing.
 *
 * `failureReason` is the field the operator acts on, and it is nullable on purpose:
 * "we did not act" and "we acted and the reason was blank" are different facts,
 * so only the first may render as a dash.
 */
export function SettlementDetailsPanel(): ReactElement {
  const { rows, status } = useSettlements();
  const stuck = rows.find((row) => row.failureReason !== null) ?? rows[0];

  return (
    <Panel title="Movement details">
      {stuck === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "movements" })
            : "Select a movement to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Batch", value: stuck.batch },
            { label: "Kind", value: stuck.kind },
            { label: "Counterparty", value: stuck.counterparty },
            { label: "Amount", value: formatMoney(stuck.amount) },
            { label: "Fee", value: formatMoney(stuck.fee) },
            { label: "Status", value: stuck.status },
            { label: "Occurred", value: new Date(stuck.occurredAt).toLocaleString() },
            {
              label: "Failure reason",
              value: stuck.failureReason ?? "None recorded",
            },
          ]}
        />
      )}
    </Panel>
  );
}
