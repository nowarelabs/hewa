"use client";

import type { ReactElement } from "react";
import { BookOpen, LineChart, PieChart } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MARKET_POOL_TITLES, type MarketOrder } from "@hewa/console-types";
import { formatMoney } from "@hewa/marketplace-types";

import { useMarketBook, usePriceHistory, useVenues } from "../data/market";
import { Empty, KeyValues, Panel, SummaryBar, emptyMessage } from "../ui/primitives";

/**
 * The `market` view's panels: two per section, and the middle column of each.
 *
 * One module for the view, one exported panel per column per section. The rule the
 * shell config is checked against is that a panel and the section it serves share a
 * name — `BookPanel` and `market/book`, `VenuesPanel` and `market/venues` — so a
 * section added to the contract without a panel here fails the config rather than
 * rendering an empty column.
 */

/**
 * `market/book`, middle column.
 *
 * The headline chips are read off the payload the book came with rather than
 * recomputed here, so the header and the table under it are one answer. There is
 * deliberately no spread chip: the book spans four pools at four price scales, so
 * its best bid and best offer are not comparable and their difference is not a
 * price. `market/prices` is where a pool's two sides sit next to each other.
 */
export function BookPanel(): ReactElement {
  const { data, status } = useMarketBook();
  const orders = data?.orders ?? [];

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <BookOpen className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Order book</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {data?.openOrders ?? 0} orders
        </span>
      </header>

      {/* No `filter`: the two figures here bound the book rather than break it down,
          and a chip that hid orders would answer a question the section already
          answers. The pool is a column, not a toggle. */}
      <SummaryBar
        items={[
          {
            label: "Best bid",
            value: data === undefined || data.bestBid === null ? "—" : formatMoney(data.bestBid),
          },
          {
            label: "Best offer",
            value:
              data === undefined || data.bestOffer === null ? "—" : formatMoney(data.bestOffer),
          },
          { label: "Committed", value: `${data?.committedGbps ?? 0} Gbps` },
          { label: "Currency", value: data?.currency ?? "—" },
        ]}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "the book" })}</Empty>
        ) : (
          <BookTable rows={orders} />
        )}
      </div>
    </div>
  );
}

function BookTable({ rows }: { rows: readonly MarketOrder[] }): ReactElement {
  return (
    <article className="rounded-lg border border-line bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Resting orders</h2>
      {rows.length === 0 ? (
        <Empty>No orders resting</Empty>
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

/** `market/book`, right column: what the book holds, in figures. */
export function BookDetails(): ReactElement {
  const { data, status } = useMarketBook();
  const bids = (data?.orders ?? []).filter((order) => order.side === "bid");
  const offers = (data?.orders ?? []).filter((order) => order.side === "offer");

  return (
    <Panel title="Book">
      {data === undefined ? (
        <Empty>{emptyMessage({ status, filtered: false, noun: "the book" })}</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Best bid", value: data.bestBid === null ? "—" : formatMoney(data.bestBid) },
            {
              label: "Best offer",
              value: data.bestOffer === null ? "—" : formatMoney(data.bestOffer),
            },
            { label: "Bids", value: bids.length },
            { label: "Offers", value: offers.length },
            { label: "Committed", value: `${data.committedGbps} Gbps` },
            {
              label: "Pools",
              value: data.orders.length === 0 ? 0 : new Set(data.orders.map((o) => o.pool)).size,
            },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `market/prices`, middle column: one line per pool, and the latest quote each.
 *
 * The chart draws from `points` and the table from `latest`, and the service derives
 * the second from the first in the same query — so the price in the table is a point
 * on the line above it rather than a second reading of the market.
 */
export function PricesPanel(): ReactElement {
  const { data, status } = usePriceHistory();
  const axis = { stroke: "#64748b", fontSize: 12 };
  const tooltip = {
    contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
    labelStyle: { color: "#f1f5f9" },
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <LineChart className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Prices</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {data?.latest.length ?? 0} pools
        </span>
      </header>

      {/* `changePct` is a figure rather than a count, so this bar passes no `filter`:
          a chip built from a percentage would hide rows on a click and answer
          nothing. */}
      <SummaryBar
        items={[
          { label: "Change", value: `${data?.changePct ?? 0}%` },
          { label: "Observations", value: data?.points.length ?? 0 },
          { label: "Currency", value: data?.currency ?? "—" },
        ]}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "prices" })}</Empty>
        ) : (
          <>
            <article className="rounded-lg border border-line bg-surface-raised p-4">
              <h2 className="mb-2 text-sm font-medium text-ink">Spot price</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartLineChart data={data.points}>
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
                  </RechartLineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-lg border border-line bg-surface-raised p-4">
              <h2 className="mb-3 text-sm font-medium text-ink">Latest by pool</h2>
              <table className="w-full text-left text-xs">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="py-1 font-medium">Pool</th>
                    <th className="py-1 text-right font-medium">Price</th>
                    <th className="py-1 font-medium">Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest.map((quote) => (
                    <tr
                      key={quote.pool}
                      data-row={quote.pool}
                      className="border-t border-line text-ink-muted"
                    >
                      <td className="py-1">{MARKET_POOL_TITLES[quote.pool]}</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(quote.price)}</td>
                      <td className="py-1">{new Date(quote.observedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </>
        )}
      </div>
    </div>
  );
}

/** `market/prices`, right column: one pool's quote and its movement. */
export function PricesDetails(): ReactElement {
  const { data, status } = usePriceHistory();

  return (
    <Panel title="Price movement">
      {data === undefined ? (
        <Empty>{emptyMessage({ status, filtered: false, noun: "prices" })}</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Change", value: `${data.changePct}%` },
            { label: "Pools quoted", value: data.latest.length },
            { label: "Observations", value: data.points.length },
            { label: "Currency", value: data.currency },
          ]}
        />
      )}
    </Panel>
  );
}

/** `market/venues`, middle column: where the committed capacity sits. */
export function VenuesPanel(): ReactElement {
  const { data, status } = useVenues();

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <PieChart className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Venues</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {data?.venues.length ?? 0} pools
        </span>
      </header>

      {/* Shares add to 100, so this bar is a breakdown and passes no filter: a
          percentage is a figure, and toggling one would hide the pool it describes. */}
      <SummaryBar
        items={[
          { label: "Committed", value: `${data?.totalCommittedGbps ?? 0} Gbps` },
          { label: "Currency", value: data?.currency ?? "—" },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "venues" })}</Empty>
        ) : (
          <article className="rounded-lg border border-line bg-surface-raised p-4">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 font-medium">Pool</th>
                  <th className="py-1 text-right font-medium">Committed</th>
                  <th className="py-1 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.venues.map((venue) => (
                  <tr
                    key={venue.pool}
                    data-row={venue.pool}
                    className="border-t border-line text-ink-muted"
                  >
                    <td className="py-1">{MARKET_POOL_TITLES[venue.pool]}</td>
                    <td className="py-1 text-right tabular-nums">{venue.committedGbps} Gbps</td>
                    <td className="py-1 text-right tabular-nums">{venue.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </div>
    </div>
  );
}

/** `market/venues`, right column: the concentration figures. */
export function VenuesDetails(): ReactElement {
  const { data, status } = useVenues();
  const top = [...(data?.venues ?? [])].toSorted((a, b) => b.share - a.share)[0];

  return (
    <Panel title="Where capacity sits">
      {data === undefined ? (
        <Empty>{emptyMessage({ status, filtered: false, noun: "venues" })}</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Committed", value: `${data.totalCommittedGbps} Gbps` },
            { label: "Pools", value: data.venues.length },
            {
              label: "Largest",
              value: top === undefined ? "—" : `${MARKET_POOL_TITLES[top.pool]} · ${top.share}%`,
            },
          ]}
        />
      )}
    </Panel>
  );
}
