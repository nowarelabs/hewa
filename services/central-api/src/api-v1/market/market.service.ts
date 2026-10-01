import { Inject, Injectable } from "@nestjs/common";
import {
  MARKET_POOL_TITLES,
  type BandwidthMarket,
  type ConsoleEnvelope,
  type MarketOrder,
  type MarketPool,
  type MarketSection,
  type VenueShare,
} from "@hewa/console-types";
import { ValidationError } from "@hewa/errors";
import { formatMoney, money, type Currency, type Money } from "@hewa/marketplace-types";
import { asc, desc, eq, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { marketOrders, marketSpots } from "../../db/schema.js";
import { envelope } from "../envelope.js";

/**
 * The unit of account the book is quoted in when it holds nothing at all.
 *
 * `USD`, from `CURRENCIES` in `@hewa/marketplace-types`, where it is described as
 * the marketplace's unit of account. This is the only place the market payload
 * names a currency no row states, and it is reachable only with an empty book —
 * where it is shown beside a count of zero and nothing else. The alternative is
 * making `currency` nullable to avoid naming a unit of account, and a panel
 * rendering "no currency" for an empty market is a worse answer.
 */
const UNIT_OF_ACCOUNT: Currency = "USD";

/**
 * How many observations of one pool a chart draws.
 *
 * Per pool, and the word is doing the work: the series in this payload holds every
 * pool's history, so the window that bounds it has to be per pool too. A single
 * global `limit` is the tempting version and it is wrong in a way that only shows up
 * on uneven data — `ORDER BY pool, observed_at DESC LIMIT 192` returns the newest 192
 * observations of *whichever pools sort first*, so the pool with the longest
 * history takes the whole budget and a thinly sampled pool is missing from the chart
 * with nothing to say so.
 */
const SPOT_WINDOW = 48;

/** What an absent side reads as. A dash, because `0.00 USD` is a price. */
const NO_QUOTE = "—";

/**
 * The book as one row per pool.
 *
 * Written as module-level fragments rather than inlined at the call site because
 * each side is a `filter (where …)`, and swapping the two produces a "best bid"
 * above the "best offer" — a crossed book, which means nothing to the reader who
 * has to decide whether to buy.
 *
 * The two `::text` casts are load-bearing. A `max` over `bigint` arrives as a
 * string in node-postgres and as a number in PGlite, and a `null` for an empty
 * side is the difference between "no bid" and "a bid of nothing". Casting in the
 * database makes both drivers return the same two things — a decimal string or
 * `null` — and the conversion happens once, in one place, below.
 */
const perPool = {
  openOrders: sql<number>`count(*)::int`,
  committedGbps: sql<number>`coalesce(sum(${marketOrders.committedGbps}), 0)::int`,
  burstGbps: sql<number>`coalesce(sum(${marketOrders.burstGbps}), 0)::int`,
  bestBidMinor: sql<
    string | null
  >`max(${marketOrders.priceMinor}) filter (where ${marketOrders.side} = 'bid')::text`,
  bestOfferMinor: sql<
    string | null
  >`min(${marketOrders.priceMinor}) filter (where ${marketOrders.side} = 'offer')::text`,
};

type PoolAggregate = {
  pool: MarketPool;
  openOrders: number;
  committedGbps: number;
  burstGbps: number;
  bestBidMinor: string | null;
  bestOfferMinor: string | null;
};

@Injectable()
export class MarketService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * The market document, from three queries and one derivation.
   *
   * ## Why the headline is derived from the per-pool aggregate
   *
   * The obvious version of this runs a second query for the book-wide best bid and
   * total, so it can show a total in a headline card that disagrees with the sum of
   * the sections under it. Two aggregates over the same table at two different
   * moments are two different answers whenever a row moves between them, and a
   * summary that disagrees with the table beside it is precisely the failure the
   * workspace is written to rule out.
   *
   * So there is no second aggregate. `bestBid` is the maximum over the pools' best
   * bids, `committedGbps` is the sum over the pools' sums, and every figure the
   * card shows is an operation on the numbers the rail column is drawn from. One
   * query, one derivation, and no ordering of the two in which they can differ.
   *
   * ## Why `bestBid` is nullable
   *
   * Because a market with nothing bidding has no best bid, and `0` is a price.
   * `max()` over no rows is `null` and that is carried through to the contract
   * rather than defaulted, so an empty side reads as "no bid" instead of as a free
   * gigabit.
   */
  async read(): Promise<ConsoleEnvelope<BandwidthMarket, never>> {
    const [pools, book, ...spotWindows] = await Promise.all([
      this.db
        .select({ pool: marketOrders.pool, ...perPool })
        .from(marketOrders)
        .groupBy(marketOrders.pool),
      this.db
        .select()
        .from(marketOrders)
        // `bid` sorts before `offer`, so the two sides stack the way a reader of a
        // book expects without a `case` expression to say so.
        .orderBy(asc(marketOrders.pool), asc(marketOrders.side), asc(marketOrders.priceMinor)),
      // One bounded query per pool rather than one global window. `Promise.all`
      // because they are independent reads against an index on `(pool, observed_at)`,
      // and the count is the size of a vocabulary that is four entries long.
      ...Object.keys(MARKET_POOL_TITLES).map((pool) =>
        this.db
          .select()
          .from(marketSpots)
          .where(eq(marketSpots.pool, pool as MarketPool))
          // Newest first, and capped: a window taken from the wrong end of the
          // table is the oldest data on a live chart.
          .orderBy(desc(marketSpots.observedAt))
          .limit(SPOT_WINDOW),
      ),
    ]);

    const currency = bookCurrency(book);
    const spots = spotWindows.flat().sort(byPoolThenTime);

    return envelope(
      toMarket(new Map(pools.map((pool) => [pool.pool, pool])), book, spots, currency),
      [],
    );
  }
}

/**
 * Pool first, then time.
 *
 * The chart draws one line per pool, so a pool's points have to arrive together and
 * in order; the panel splits the series on `pool` and would otherwise draw a
 * staircase if the two sequences interleaved.
 */
function byPoolThenTime(
  a: { pool: string; observedAt: Date },
  b: { pool: string; observedAt: Date },
): number {
  return a.pool.localeCompare(b.pool) || a.observedAt.getTime() - b.observedAt.getTime();
}

/**
 * The one currency every order is priced in, or the unit of account for an empty
 * book.
 *
 * Refuses a book quoted in two currencies rather than picking one. `BandwidthMarket`
 * declares a single `currency` for the whole payload, so a mixed book has no honest
 * rendering: whichever side won, the other figure would be labelled in the wrong
 * unit, and a price in the wrong currency is worse than no price at all.
 */
function bookCurrency(book: readonly { currency: Currency }[]): Currency {
  const quoted = [...new Set(book.map((order) => order.currency))];
  if (quoted.length > 1) {
    throw new ValidationError("The order book is quoted in more than one currency", {
      currencies: quoted,
    });
  }
  return quoted[0] ?? UNIT_OF_ACCOUNT;
}

/**
 * Assemble the document.
 *
 * A free function taking three arrays and a currency, not a method, because it
 * touches no connection — which is what lets the arithmetic be read, and the
 * largest-remainder share rule be asserted on a seeded book, without standing up
 * anything. `tests/api-v1.e2e.test.ts` drives it against PGlite and pins the shares
 * to exact numbers.
 */
function toMarket(
  pools: ReadonlyMap<MarketPool, PoolAggregate>,
  book: readonly {
    id: string;
    pool: MarketPool;
    side: MarketOrder["side"];
    provider: string;
    committedGbps: number;
    burstGbps: number;
    priceMinor: number;
    submittedAt: Date;
  }[],
  spots: readonly { pool: MarketPool; priceMinor: number; observedAt: Date }[],
  currency: Currency,
): BandwidthMarket {
  return {
    bestBid: headline(pools, "bestBidMinor", currency, Math.max),
    bestOffer: headline(pools, "bestOfferMinor", currency, Math.min),
    committedGbps: total(pools, "committedGbps"),
    openOrders: total(pools, "openOrders"),
    currency,
    // Each pool's window came back newest-first, and a chart draws left to right in
    // time, so the order is fixed here rather than by an `orderBy` that would have
    // to know the window's size first.
    priceSeries: spots.map((spot) => ({
      pool: spot.pool,
      at: spot.observedAt.toISOString(),
      price: money(spot.priceMinor, currency),
    })),
    venues: venues(pools),
    // Every pool gets a section whether or not anybody has quoted it this week: the
    // rail picks between sections, and a tab that vanishes with the data is a
    // control that is only sometimes there. An unquoted pool's figures read "no
    // bid" and "0 Gbps", which is the truth rather than a gap.
    sections: Object.entries(MARKET_POOL_TITLES).map(([pool, title]) =>
      sectionFor(pool as MarketPool, title, pools.get(pool as MarketPool), currency),
    ),
    book: book.map((order) => ({
      id: order.id,
      pool: order.pool,
      side: order.side,
      provider: order.provider,
      committedGbps: order.committedGbps,
      burstGbps: order.burstGbps,
      unitPrice: money(order.priceMinor, currency),
      submittedAt: order.submittedAt.toISOString(),
    })),
  };
}

/**
 * A `Money`, or `null` when no pool has that side.
 *
 * The comparator is a parameter because "best bid" is a maximum and "best offer"
 * is a minimum, and the two differ only in that one argument — spelled out twice it
 * would be two chances to leave one of them as a maximum.
 *
 * `money()` is what refuses an amount the API cannot represent exactly. A
 * `bigint` column holding more than `Number.MAX_SAFE_INTEGER` arrives as a decimal
 * string, `Number` rounds it, and the rounded figure would be a price. Throwing
 * says the database and the wire format disagree, which is true and worth knowing.
 */
function headline(
  pools: ReadonlyMap<MarketPool, PoolAggregate>,
  field: "bestBidMinor" | "bestOfferMinor",
  currency: Currency,
  pick: (...values: number[]) => number,
): Money | null {
  const quotes = [...pools.values()]
    .map((pool) => pool[field])
    .filter((value): value is string => value !== null)
    .map(Number);
  return quotes.length === 0 ? null : money(pick(...quotes), currency);
}

function total(
  pools: ReadonlyMap<MarketPool, PoolAggregate>,
  field: "committedGbps" | "burstGbps" | "openOrders",
): number {
  let sum = 0;
  for (const pool of pools.values()) sum += pool[field];
  return sum;
}

/**
 * Whole percentages that add to exactly 100.
 *
 * Largest-remainder: each pool takes the whole part of its exact share, and the
 * leftover points go one each to the pools with the largest discarded fractions.
 * Rounding each share independently is the obvious version and it is wrong — four
 * pools at 24.6% come to 100 while four at 24.4% come to 96, and a pie whose
 * slices do not fill the circle misreports its own data. `VenueShare` promises the
 * set adds up, so the arithmetic has to be the kind that keeps that promise for
 * every input, not the kind that is right most of the time.
 *
 * Ties break by pool name so the same book always draws the same pie; without that,
 * two loads of identical data could award the leftover point differently and the
 * chart would flicker on refresh.
 *
 * An empty book gives every pool 0, because there is no volume to divide.
 */
function venues(pools: ReadonlyMap<MarketPool, PoolAggregate>): VenueShare[] {
  const committed = total(pools, "committedGbps");

  const shares = [...pools.values()]
    .map((pool) => {
      const exact = committed === 0 ? 0 : (pool.committedGbps * 100) / committed;
      return { pool: pool.pool, share: Math.floor(exact), remainder: exact - Math.floor(exact) };
    })
    .sort((a, b) => b.remainder - a.remainder || a.pool.localeCompare(b.pool));

  let leftover = 100 - shares.reduce((points, entry) => points + entry.share, 0);
  for (const entry of shares) {
    if (leftover === 0) break;
    entry.share += 1;
    leftover -= 1;
  }
  return shares.map(({ pool, share }) => ({ pool, share }));
}

function sectionFor(
  pool: MarketPool,
  title: string,
  aggregate: PoolAggregate | undefined,
  currency: Currency,
): MarketSection {
  const bid = quote(aggregate?.bestBidMinor, currency);
  const offer = quote(aggregate?.bestOfferMinor, currency);

  return {
    id: pool,
    title,
    figures: [
      { label: "Best bid", value: bid === null ? NO_QUOTE : formatMoney(bid) },
      { label: "Best offer", value: offer === null ? NO_QUOTE : formatMoney(offer) },
      {
        label: "Spread",
        value:
          bid === null || offer === null
            ? NO_QUOTE
            : formatMoney(money(offer.amountMinor - bid.amountMinor, currency)),
      },
      { label: "Committed", value: `${aggregate?.committedGbps ?? 0} Gbps` },
      { label: "Burst", value: `${aggregate?.burstGbps ?? 0} Gbps` },
      { label: "Open orders", value: String(aggregate?.openOrders ?? 0) },
    ],
  };
}

/** `undefined` and `null` mean the same thing here: nobody quoted that side. */
function quote(minor: string | null | undefined, currency: Currency): Money | null {
  return minor === null || minor === undefined ? null : money(Number(minor), currency);
}
