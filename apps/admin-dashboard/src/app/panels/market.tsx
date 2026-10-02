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
import {
  MARKET_POOLS,
  MARKET_POOL_TITLES,
  MARKET_SIDES,
  type MarketOrder,
  type MarketQuote,
  type OrderWrite,
  type SpotRecord,
  type VenueShare,
} from "@hewa/console-types";
import { formatMoney, type Currency } from "@hewa/marketplace-types";

import {
  CURRENCY_FIELDS,
  RecordEditor,
  asWrite,
  editorIdField,
  type FieldSpec,
  useRecordWrite,
} from "../ui/editor";
import { createOrder, deleteOrder, patchOrder } from "../mutations/orders";
import { createSpot, upsertSpot } from "../mutations/spots";

import { useMarketBook, usePriceHistory, useVenues } from "../data/market";
import { useSearchParam } from "../state/filter";
import type { SectionStatus } from "../state/query";
import { Empty, KeyValues, Panel, SummaryBar, emptyMessage } from "../ui/primitives";
import { SearchPanel, searchRows } from "../ui/search";

/**
 * The `market` view's panels: two per section, and the middle column of each.
 *
 * One module for the view, one exported panel per column per section. The rule the
 * shell config is checked against is that a panel and the section it serves share a
 * name — `BookPanel` and `market/book`, `VenuesPanel` and `market/venues` — so a
 * section added to the contract without a panel here fails the config rather than
 * rendering an empty column.
 *
 * All three sections search rather than filter: the service publishes no vocabulary
 * for any of them, so there is no group to toggle and the column beside the rail
 * finds rows by name instead — a book and a price series are documents rather than
 * lists of things, and a toggle over a document narrows nothing.
 */

/**
 * A section's search, over whatever it lists.
 *
 * One wrapper over three sections rather than three copies, and the rows are
 * counted here rather than by the panel it draws: the column is the one place that
 * says how many rows are in force, so it needs the count and the main column needs
 * the rows, and neither should be the place the other reads from.
 */
function PoolSearch<TRow>({
  rows,
  status,
  section,
  noun,
  fields,
}: {
  rows: readonly TRow[];
  status: SectionStatus;
  section: string;
  noun: string;
  fields: (row: TRow) => readonly string[];
}): ReactElement {
  const search = useSearchParam(section);

  return (
    <SearchPanel
      noun={noun}
      status={status}
      query={search.query}
      onChange={search.set}
      onClear={search.clear}
      matched={searchRows(rows, search.query, fields).length}
      total={rows.length}
    />
  );
}

/** What a pool's latest quote is found by. */
const quoteFields = (quote: MarketQuote): readonly string[] => [MARKET_POOL_TITLES[quote.pool]];

/** What a venue's share is found by. */
const venueFields = (venue: VenueShare): readonly string[] => [MARKET_POOL_TITLES[venue.pool]];

/** What an order is found by: the pool it is in, who offers it, and which side. */
const orderFields = (order: MarketOrder): readonly string[] => [
  MARKET_POOL_TITLES[order.pool],
  order.provider,
  order.side,
];

/** `market/book`, left column: find an order. */
export function BookSearch(): ReactElement {
  const { data, status } = useMarketBook();
  return (
    <PoolSearch
      rows={data?.orders ?? []}
      status={status}
      section="market/book"
      noun="orders"
      fields={orderFields}
    />
  );
}

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
  const search = useSearchParam("market/book");
  const shown = searchRows(data?.orders ?? [], search.query, orderFields);

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

      <div className="min-h-0 flex-1 space-y-4 overflow-auto main-inset">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "the book" })}</Empty>
        ) : shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: search.query.trim() !== "",
              noun: "orders",
              filter: `“${search.query.trim()}”`,
            })}
          </Empty>
        ) : (
          <BookTable rows={shown} />
        )}
      </div>
    </div>
  );
}

function BookTable({ rows }: { rows: readonly MarketOrder[] }): ReactElement {
  return (
    <article className="rounded-lg border border-line bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Resting orders</h2>
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
            <tr key={order.id} data-row={order.id} className="border-t border-line text-ink-muted">
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
    </article>
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
  const search = useSearchParam("market/prices");
  const axis = { stroke: "#64748b", fontSize: 12 };
  const tooltip = {
    contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
    labelStyle: { color: "#f1f5f9" },
  };
  const shown = searchRows(data?.latest ?? [], search.query, quoteFields);

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

      <div className="min-h-0 flex-1 space-y-4 overflow-auto main-inset">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "prices" })}</Empty>
        ) : (
          <>
            {/* The chart is the whole series and the search is over the table, so
                the two are not narrowed together: a reader who searched for one
                pool wants its row and the shape of the market around it, and a
                chart redrawn to a single pool is a straight line that answers
                nothing. The bar above already says which pool the series is. */}
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
              {shown.length === 0 ? (
                <Empty>
                  {emptyMessage({
                    status,
                    filtered: search.query.trim() !== "",
                    noun: "pools",
                    filter: `“${search.query.trim()}”`,
                  })}
                </Empty>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-faint">
                    <tr>
                      <th className="py-1 font-medium">Pool</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 font-medium">Observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((quote) => (
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
              )}
            </article>
          </>
        )}
      </div>
    </div>
  );
}

/** `market/prices`, left column: find a pool. */
export function PricesSearch(): ReactElement {
  const { data, status } = usePriceHistory();
  return (
    <PoolSearch
      rows={data?.latest ?? []}
      status={status}
      section="market/prices"
      noun="pools"
      fields={quoteFields}
    />
  );
}

/** `market/venues`, middle column: where the committed capacity sits. */
export function VenuesPanel(): ReactElement {
  const { data, status } = useVenues();
  const search = useSearchParam("market/venues");
  const shown = searchRows(data?.venues ?? [], search.query, venueFields);

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

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {data === undefined ? (
          <Empty>{emptyMessage({ status, filtered: false, noun: "venues" })}</Empty>
        ) : shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: search.query.trim() !== "",
              noun: "pools",
              filter: `“${search.query.trim()}”`,
            })}
          </Empty>
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

/** `market/venues`, left column: find a pool. */
export function VenuesSearch(): ReactElement {
  const { data, status } = useVenues();
  return (
    <PoolSearch
      rows={data?.venues ?? []}
      status={status}
      section="market/venues"
      noun="pools"
      fields={venueFields}
    />
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

/**
 * `market/book`, right column: the order this section is about, editable, under the
 * book's own figures.
 *
 * The figures stay. Best bid, best offer and committed capacity are not columns of an
 * order, and a form is the wrong place for them — they are the section's summary, so
 * they stay above it and the order's own eight columns become inputs.
 *
 * The currency is read-only while editing, and the reason is on the field: the book
 * is quoted in one currency and central-api refuses an order priced in another
 * before it reaches the database. An operator who could type a different currency
 * here would fill the form in carefully and be refused by a rule they cannot see.
 */
export function OrderEditor({ section }: { section: string | null }): ReactElement {
  const { data, refetch } = useMarketBook();
  // The book quotes one currency for every order in it, so the adapter takes it as
  // an argument rather than reading it off the order.
  const rows = (data?.orders ?? []).map((order) => orderWriteFields(order, data?.currency));

  const write = useRecordWrite<OrderWriteRow>({
    rows,
    selected: section,
    keyOf: (row) => row.id,
    create: (body) => createOrder(asWrite(body)),
    save: (id, body) => patchOrder(id, asWrite(body)),
    remove: (id) => deleteOrder(id),
    onSaved: refetch,
  });

  return (
    <RecordEditor
      noun="order"
      fields={ORDER_FIELDS}
      write={write}
      submitLabel="Save order"
      deleteLabel="Withdraw order"
      summary={
        data === undefined ? null : (
          <KeyValues
            rows={[
              { label: "Best bid", value: data.bestBid === null ? "—" : formatMoney(data.bestBid) },
              {
                label: "Best offer",
                value: data.bestOffer === null ? "—" : formatMoney(data.bestOffer),
              },
              { label: "Committed", value: `${data.committedGbps} Gbps` },
              { label: "Quoted in", value: data.currency },
            ]}
          />
        )
      }
    />
  );
}

/**
 * An order in the shape a write takes, with the id the panel addresses it by.
 *
 * The read record holds `unitPrice` as a `Money` because a table draws the amount
 * beside its currency. The write takes `priceMinor` and a `currency`, so the two are
 * joined here rather than in the form — which keeps `asWrite` the one place in the
 * app where a read shape is asserted to be a write shape.
 */
type OrderWriteRow = OrderWrite & { readonly id: string };

/**
 * A resting order as the columns a write carries.
 *
 * The same adaptation the spot and the movement need, for the same reason: a read
 * record holds money as an object because a table draws it with its currency beside
 * it, and a write takes the amount and the currency as two columns. Doing it here
 * rather than in the form means the form is handed something shaped like the
 * contract, so the `asWrite` assertion is the only place in the app that crosses
 * between a read shape and a write shape.
 *
 * The currency comes from the book rather than from the order, because it is the
 * book's: an order priced in a currency the book is not quoted in would be refused
 * by the service, so reading it from the row would only ever reproduce the value
 * that is already correct.
 */
function orderWriteFields(order: MarketOrder, currency: Currency | undefined): OrderWriteRow {
  return {
    id: order.id,
    pool: order.pool,
    side: order.side,
    provider: order.provider,
    committedGbps: order.committedGbps,
    burstGbps: order.burstGbps,
    priceMinor: order.unitPrice.amountMinor,
    currency: currency ?? order.unitPrice.currency,
    submittedAt: order.submittedAt,
  };
}

/** Every column `OrderWrite` accepts. */
export const ORDER_FIELDS: readonly FieldSpec[] = [
  editorIdField("orders"),
  {
    name: "pool",
    label: "Pool",
    kind: "select",
    options: MARKET_POOLS.map((value) => ({ value, label: MARKET_POOL_TITLES[value] })),
  },
  {
    name: "side",
    label: "Side",
    kind: "select",
    options: MARKET_SIDES.map((value) => ({ value, label: value })),
  },
  { name: "provider", label: "Provider", kind: "text" },
  { name: "committedGbps", label: "Committed", kind: "number", step: 0.1, hint: "Gbps" },
  { name: "burstGbps", label: "Burst", kind: "number", step: 0.1, hint: "Gbps" },
  {
    name: "priceMinor",
    label: "Unit price",
    kind: "number",
    step: 1,
    hint: "minor units of the book's currency",
  },
  {
    name: "currency",
    label: "Currency",
    kind: "select",
    options: CURRENCY_FIELDS,
    lockedWhenEditing:
      "The book is quoted in one currency. An order priced in another is refused before it is stored, so it is not offered here.",
  },
  { name: "submittedAt", label: "Submitted at", kind: "instant" },
];

/**
 * `market/prices`, right column: the latest observation per pool, editable.
 *
 * Two things are different about a spot and both come from its key.
 *
 * Its id is generated, so there is nothing for a `PATCH` to address and every save
 * is the upsert on `(pool, observedAt)` — which is also the honest operation, since
 * correcting a price a sampler produced and recording it are the same request. The
 * read document does not carry an id for exactly that reason, and this panel is
 * written so it never needs one.
 *
 * And `observedAt` is therefore locked while editing: it is half of what makes this
 * observation this observation. Changing it does not correct the row, it records a
 * different one, which is a field for the "New observation" case rather than for
 * this one.
 *
 * The one adapter between the two shapes is {@link spotWriteFields}, and it exists
 * here rather than in the contract because it is a fact about the read document: the
 * read side hands over money as an object and the write side takes two columns.
 */
export function SpotEditor({ section }: { section: string | null }): ReactElement {
  const { data, refetch } = usePriceHistory();
  const rows = (data?.latest ?? []).map(spotWriteFields);

  const write = useRecordWrite<SpotRecord>({
    rows,
    selected: section,
    keyOf: (row) => row.id,
    create: (body) => createSpot(asWrite(body)),
    // The pool is this editor's identity, so there is no id to send: the upsert is
    // addressed by the natural key the body carries, which is the whole operation.
    save: (_id, body) => upsertSpot(asWrite(body)),
    onSaved: refetch,
  });

  return (
    <RecordEditor
      noun="observation"
      fields={SPOT_FIELDS}
      write={write}
      submitLabel="Record observation"
      summary={
        data === undefined ? null : (
          <KeyValues
            rows={[
              { label: "Change", value: `${data.changePct}%` },
              { label: "Pools quoted", value: data.latest.length },
              { label: "Observations", value: data.points.length },
              { label: "Quoted in", value: data.currency },
            ]}
          />
        )
      }
    />
  );
}

/**
 * A read quote as the columns a write carries.
 *
 * `MarketQuote` holds a `Money` and no id, because a panel drawing a chart has no
 * use for either. The write contract holds `priceMinor`, `currency` and a generated
 * `id`, so this is the one place the two are joined: the id is the pool, which is
 * enough to address the observation in this panel and is not sent.
 */
function spotWriteFields(quote: MarketQuote): SpotRecord {
  return {
    id: quote.pool,
    pool: quote.pool,
    priceMinor: quote.price.amountMinor,
    currency: quote.price.currency,
    observedAt: quote.observedAt,
  };
}

/** Every column `SpotWrite` accepts. */
export const SPOT_FIELDS: readonly FieldSpec[] = [
  {
    name: "pool",
    label: "Pool",
    kind: "select",
    options: MARKET_POOLS.map((value) => ({ value, label: MARKET_POOL_TITLES[value] })),
    lockedWhenEditing:
      "A pool's current price is one observation. Start a new one to move it to another pool.",
  },
  {
    name: "priceMinor",
    label: "Price",
    kind: "number",
    step: 1,
    hint: "minor units of the quoted currency",
  },
  { name: "currency", label: "Currency", kind: "select", options: CURRENCY_FIELDS },
  {
    name: "observedAt",
    label: "Observed at",
    kind: "instant",
    lockedWhenEditing:
      "Half of this observation's key. Changing it here would record a different observation rather than correct this one.",
  },
];
