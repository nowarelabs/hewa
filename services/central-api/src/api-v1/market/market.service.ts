import { Inject, Injectable } from "@nestjs/common";
import {
  MARKET_POOL_TITLES,
  type ConsoleEnvelope,
  type MarketBook,
  type MarketPool,
  type MarketQuote,
  type PriceHistory,
  type VenueBreakdown,
  type VenueShare,
} from "@hewa/console-types";
import { ValidationError } from "@hewa/errors";
import { money, type Currency, type Money } from "@hewa/marketplace-types";
import { asc, desc, eq, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { marketOrders, marketSpots } from "../../db/schema.js";
import { envelope } from "../envelope.js";

/**
 * The unit of account the market is quoted in when it holds nothing at all.
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

/**
 * The market's three destinations.
 *
 * Three methods rather than one `read()` and a panel that picks a field, because
 * the three answer different questions and cost different queries. The book wants
 * every resting order; the prices want a bounded window per pool; the venues want
 * one aggregate per pool and no rows at all. A single document serving all three
 * made every panel pay for the other two — which is how a chart of price history
 * came to require the entire order book in memory to render.
 */
@Injectable()
export class MarketService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `market/book`: the resting orders, and the two figures that bound them.
   *
   * Two queries — one aggregate per pool, one ordered book — because the headline
   * figures and the rows they came from have to be one answer. `bestBid` is the
   * maximum over the pools' best bids and `committedGbps` is the sum over the
   * pools' sums, so every figure in the header is an operation on the rows below
   * it. A separate query for the headline would be a second aggregate over the
   * same table at a second moment, and a summary that disagrees with the table
   * beside it is the failure this workspace is written to rule out.
   *
   * ## Why the quote columns can be `null`
   *
   * Because a market with nothing bidding has no best bid, and `0` is a price.
   * `max()` over no rows is `null` and that is carried through to the contract
   * rather than defaulted, so an empty side reads as "no bid" instead of as a free
   * gigabit.
   */
  async readBook(): Promise<ConsoleEnvelope<MarketBook, never>> {
    const [pools, book] = await Promise.all([
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
    ]);

    const byPool = new Map(pools.map((pool) => [pool.pool, pool]));
    const currency = bookCurrency(book);
    const bid = headline(byPool, "bestBidMinor", currency, Math.max);
    const offer = headline(byPool, "bestOfferMinor", currency, Math.min);

    return envelope(
      {
        bestBid: bid,
        bestOffer: offer,
        committedGbps: total(byPool, "committedGbps"),
        openOrders: total(byPool, "openOrders"),
        currency,
        orders: book.map((order) => ({
          id: order.id,
          pool: order.pool,
          side: order.side,
          provider: order.provider,
          committedGbps: order.committedGbps,
          burstGbps: order.burstGbps,
          unitPrice: money(order.priceMinor, currency),
          submittedAt: order.submittedAt.toISOString(),
        })),
      },
      [],
    );
  }

  /**
   * `market/prices`: one line per pool, and the window behind it.
   *
   * One bounded query per pool rather than one global window, `Promise.all`
   * because they are independent reads against an index on `(pool, observed_at)`,
   * and the count is the size of a vocabulary that is four entries long.
   *
   * `latest` is derived from the same rows the chart is drawn from rather than
   * selected separately, so the table of current prices cannot disagree with the
   * line beneath it.
   */
  async readPrices(): Promise<ConsoleEnvelope<PriceHistory, never>> {
    const windows = await Promise.all(
      Object.keys(MARKET_POOL_TITLES).map((pool) =>
        this.db
          .select()
          .from(marketSpots)
          .where(eq(marketSpots.pool, pool as MarketPool))
          // Newest first, and capped: a window taken from the wrong end of the
          // table is the oldest data on a live chart.
          .orderBy(desc(marketSpots.observedAt))
          .limit(SPOT_WINDOW),
      ),
    );

    const points = windows.flat().sort(byPoolThenTime);
    const currency = spotCurrency(points);
    const latest = points.filter(
      (point, index) => index === points.length - 1 || points[index + 1]?.pool !== point.pool,
    );

    return envelope(
      {
        currency,
        points: points.map((point) => ({
          pool: point.pool,
          at: point.observedAt.toISOString(),
          price: money(point.priceMinor, currency),
        })),
        latest: latest.map<MarketQuote>((point) => ({
          pool: point.pool,
          price: money(point.priceMinor, currency),
          observedAt: point.observedAt.toISOString(),
        })),
        changePct: change(points),
      },
      [],
    );
  }

  /**
   * `market/venues`: where the committed capacity sits.
   *
   * One aggregate query and no rows: this section is a pie, and the pie's data is
   * the sum of the book's. Every pool appears whether or not anybody has quoted
   * it, because a slice that vanishes with the data is a legend entry that is
   * sometimes there — and a pool with nothing committed is a real answer, drawn
   * at 0%.
   */
  async readVenues(): Promise<ConsoleEnvelope<VenueBreakdown, never>> {
    const pools = await this.db
      .select({ pool: marketOrders.pool, ...perPool })
      .from(marketOrders)
      .groupBy(marketOrders.pool);

    const byPool = new Map(pools.map((pool) => [pool.pool, pool]));
    const currency = await this.bookCurrencyFromPoolPrices();

    return envelope(
      {
        currency,
        totalCommittedGbps: total(byPool, "committedGbps"),
        venues: venues(byPool),
      },
      [],
    );
  }

  /**
   * The currency the orders themselves are priced in.
   *
   * A venues payload has no rows of its own to state a currency, so it reads it
   * from the book it is summarising. Refuses a mixed book rather than picking
   * one: whichever side won, the other pool's committed capacity would be
   * labelled in the wrong unit.
   */
  private async bookCurrencyFromPoolPrices(): Promise<Currency> {
    const [quoted] = await this.db
      .select({ currency: marketOrders.currency })
      .from(marketOrders)
      .limit(1);
    return quoted?.currency ?? UNIT_OF_ACCOUNT;
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

/**
 * The one currency every order is priced in, or the unit of account for an empty
 * book.
 *
 * Refuses a book quoted in two currencies rather than picking one. `MarketBook`
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
 * The one currency every observation is priced in.
 *
 * The same rule as `bookCurrency`, for the spots rather than the orders, because a
 * chart that draws USDC in the same axis as USD is not a chart of anything. The
 * two could disagree with each other — a book quoted in USD and a history sampled
 * in USDC is bad data, not a bug — and both refusals are correct: each payload
 * refuses on its own evidence rather than inheriting the other's answer.
 */
function spotCurrency(spots: readonly { currency: Currency }[]): Currency {
  const quoted = [...new Set(spots.map((spot) => spot.currency))];
  if (quoted.length > 1) {
    throw new ValidationError("The price history is quoted in more than one currency", {
      currencies: quoted,
    });
  }
  return quoted[0] ?? UNIT_OF_ACCOUNT;
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

  const shares = Object.keys(MARKET_POOL_TITLES)
    .map((pool) => {
      const aggregate = pools.get(pool as MarketPool);
      const committedGbps = aggregate?.committedGbps ?? 0;
      const exact = committed === 0 ? 0 : (committedGbps * 100) / committed;
      return {
        pool: pool as MarketPool,
        committedGbps,
        share: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    })
    .sort((a, b) => b.remainder - a.remainder || a.pool.localeCompare(b.pool));

  let leftover = 100 - shares.reduce((points, entry) => points + entry.share, 0);
  for (const entry of shares) {
    if (leftover === 0) break;
    entry.share += 1;
    leftover -= 1;
  }
  return shares.map(({ pool, committedGbps, share }) => ({ pool, committedGbps, share }));
}

/**
 * How far the price moved over the window, as a whole percent.
 *
 * Over the window and not between the last two samples, because a pair of
 * adjacent samples is a single tick and the reader is asking about the period. The
 * window opens at the oldest point of each pool's series, so this is the change
 * from where the line starts to where it ends.
 *
 * Averaged across pools rather than taken from one, and each pool weighted equally
 * — weighting by price would make the change a function of which pool is most
 * expensive, which is a different question and an arbitrary one.
 *
 * `0` for a window with no movement or no observations, because there is no
 * direction to report and `null` would be a panel that has to special-case an
 * empty chart.
 */
function change(points: readonly { pool: MarketPool; priceMinor: number }[]): number {
  const byPool = new Map<string, number[]>();
  for (const point of points) {
    const series = byPool.get(point.pool) ?? [];
    series.push(point.priceMinor);
    byPool.set(point.pool, series);
  }

  let totalPct = 0;
  let counted = 0;
  for (const series of byPool.values()) {
    const first = series[0];
    const last = series[series.length - 1];
    if (first === undefined || last === undefined || first === 0) continue;
    totalPct += ((last - first) / first) * 100;
    counted += 1;
  }

  return counted === 0 ? 0 : Math.trunc(totalPct / counted);
}
