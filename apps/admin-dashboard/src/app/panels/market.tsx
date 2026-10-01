"use client";

import type { ReactElement } from "react";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@hewa/marketplace-types";

import type { PanelProps } from "@hewa/app-shell";
import type { MarketPool } from "../data/market";
import { MARKET_POOL_TITLES } from "@hewa/console-types";
import { useMarket } from "../data/market";
import { Empty, KeyValues, Panel, SummaryBar, emptyMessage } from "../ui/primitives";

/**
 * The `market` view: every panel the Market tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks the pool, the middle column shows the book
 * and the price series, and the right column describes the selection.
 */

/**
 * The rail's entries, which are the pools themselves.
 *
 * Ids are the `MarketPool` values rather than slugs, so the rail selection joins
 * against `SpotPoint.pool` and `MarketSection.id` with no lookup table. The
 * titles come from the service's own vocabulary, so the rail and the section that
 * names itself cannot drift.
 */
export const MARKET_RAIL: readonly { id: MarketPool; label: string }[] = Object.entries(
  MARKET_POOL_TITLES,
).map(([id, label]) => ({ id: id as MarketPool, label }));

/**
 * The pool a rail selection means.
 *
 * A stale selection resolves to the first pool rather than to nothing: the rail
 * selection travels in the query string and outlives the vocabulary it names, and
 * a panel that rendered nothing would be reporting a rename as an outage.
 */
export function poolFor(item: string | null): MarketPool | null {
  if (item === null) {
    return null;
  }
  return MARKET_RAIL.find((entry) => entry.id === item)?.id ?? MARKET_RAIL[0]?.id ?? null;
}

/** The left column: one pool's figures, resolved from the rail selection. */
export function MarketRailPanel({ item }: PanelProps): ReactElement {
  const { data, status } = useMarket();
  const pool = poolFor(item);
  const section = data?.sections.find((candidate) => candidate.id === pool);

  return (
    <Panel title={section?.title ?? MARKET_POOL_TITLES[pool ?? "nairobi_ixp"]}>
      {section === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "market figures" })
            : "No figures for this pool"}
        </Empty>
      ) : (
        <KeyValues rows={[...section.figures]} />
      )}
    </Panel>
  );
}

/**
 * The main column: the headline figures, the price series, and the book.
 *
 * Every figure below is read from the document the service sent, and the headline
 * is the same aggregate the rail sections were derived from. There is no second
 * copy of the totals in this file to fall out of step with the rows drawn
 * underneath them.
 */
export function MarketTable({ item }: PanelProps): ReactElement {
  const { data, status } = useMarket();
  const pool = poolFor(item);
  const series = (data?.priceSeries ?? []).filter((point) => pool === null || point.pool === pool);
  const book = (data?.book ?? []).filter((order) => pool === null || order.pool === pool);
  const axis = { stroke: "#64748b", fontSize: 12 };
  const tooltip = {
    contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
    labelStyle: { color: "#f1f5f9" },
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <TrendingUp className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Bandwidth market</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {data?.openOrders ?? 0} orders
        </span>
      </header>

      {/* No `filter`: this view's bar is aggregates, not groups. A chip with a
          toggle on it would hide half the book on a click, and the pool it would
          filter is already the rail's job. */}
      <SummaryBar
        items={[
          {
            label: "Best bid",
            value: data?.bestBid === null || data === undefined ? "—" : formatMoney(data.bestBid),
          },
          {
            label: "Best offer",
            value:
              data?.bestOffer === null || data === undefined ? "—" : formatMoney(data.bestOffer),
          },
          { label: "Committed", value: `${data?.committedGbps ?? 0} Gbps` },
          { label: "Currency", value: data?.currency ?? "—" },
        ]}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "the market" })}</Empty>
        ) : (
          <>
            <article className="rounded-lg border border-line bg-surface-raised p-4">
              <h2 className="mb-2 text-sm font-medium text-ink">Spot price</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="at" {...axis} />
                    <YAxis {...axis} />
                    <Tooltip {...tooltip} />
                    <Line
                      type="monotone"
                      dataKey="price.amountMinor"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <BookTable rows={book} />
          </>
        )}
      </div>
    </div>
  );
}

function BookTable({
  rows,
}: {
  rows: readonly import("@hewa/console-types").MarketOrder[];
}): ReactElement {
  return (
    <article className="rounded-lg border border-line bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Order book</h2>
      {rows.length === 0 ? (
        <Empty>No orders on this side of the book</Empty>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
            <tr>
              <th className="py-1 font-medium">Pool</th>
              <th className="py-1 font-medium">Side</th>
              <th className="py-1 font-medium">Provider</th>
              <th className="py-1 text-right font-medium">Committed</th>
              <th className="py-1 text-right font-medium">Burst</th>
              <th className="py-1 text-right font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr
                key={order.id}
                data-row={order.id}
                className="border-t border-line text-ink-muted"
              >
                <td className="py-1">{MARKET_POOL_TITLES[order.pool]}</td>
                <td className="py-1">{order.side}</td>
                <td className="py-1">{order.provider}</td>
                <td className="py-1 text-right tabular-nums">{order.committedGbps} Gbps</td>
                <td className="py-1 text-right tabular-nums">{order.burstGbps} Gbps</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(order.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

/** The right column: the pool the rail has selected, and what it holds. */
export function MarketDetailsPanel({ item }: PanelProps): ReactElement {
  const { data, status } = useMarket();
  const pool = poolFor(item);
  const section = data?.sections.find((candidate) => candidate.id === pool);
  const orders = (data?.book ?? []).filter((order) => order.pool === pool);

  return (
    <Panel title={section?.title ?? "Pool"}>
      {section === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "pool figures" })
            : "Select a pool to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            ...section.figures,
            { label: "Orders", value: orders.length },
            {
              label: "Venue share",
              value: `${data?.venues.find((entry) => entry.pool === pool)?.share ?? 0}%`,
            },
          ]}
        />
      )}
    </Panel>
  );
}
