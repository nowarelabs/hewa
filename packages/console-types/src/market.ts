import type { Currency, Money } from "@hewa/marketplace-types";

/**
 * The `market` view: the bandwidth order book and what it says about price.
 *
 * This is the one view whose payload is not a list of rows, and the reason is
 * the same as it was for the economy: a market has four shapes to deliver at
 * once — the headline figures, the series behind the price chart, the pool
 * breakdown the pie draws, the per-pool figures the rail column shows, and the
 * book itself — and a panel needs all of them together. So `BandwidthMarket` is
 * an object and the other four views are arrays.
 *
 * Which is also why the rail's figures live here rather than in the panel. When
 * they were literals in the panel they sat beside a second copy of the same
 * numbers, and the two drifted: the rail said one committed total while the
 * headline card beside it said another, in the same column of the same screen.
 *
 * Every figure below is derived from `book` by the same query that returns it.
 * There is no table of precomputed headlines to fall out of step with the rows
 * drawn underneath them, which is the whole reason there is not one.
 */

/**
 * The trading pools, which is what the rail picks between.
 *
 * A pool is a corridor: a place, a route, or a geography that traffic is priced
 * for. The list is a vocabulary rather than a set of whatever is in the rows, so
 * a pool with nothing quoted this week still gets a tab — a filter that appears
 * and disappears with the data is a control that is only sometimes there.
 */
export type MarketPool = "nairobi_ixp" | "mombasa_corridor" | "east_africa_subsea" | "cdn_edge";

/**
 * Which side of the book an order is on.
 *
 * A bid is a buyer wanting capacity, an offer is a supplier selling it, and the
 * two are counted separately because "what is being asked for" and "what is on
 * sale" are different questions.
 */
export type MarketSide = "bid" | "offer";

/**
 * Every {@link MarketSide}, in the order a book reads them.
 *
 * A runtime list beside the union rather than a pair of literals in a filter bar,
 * and typed `readonly MarketSide[]` so a side added to the union without a place in
 * this order is a compile error rather than a chip that sorts to the bottom of a
 * rail. The same reasoning gives `ALERT_SEVERITIES` and `NODE_STATUSES` their
 * lists; this one has a column to feed rather than a filter bar, and it needs the
 * list anyway so the two halves of an order cannot disagree about what a side is.
 */
export const MARKET_SIDES: readonly MarketSide[] = ["bid", "offer"];

/** One resting order. */
export interface MarketOrder {
  readonly id: string;
  readonly pool: MarketPool;
  readonly side: MarketSide;
  readonly provider: string;
  /** Whole gigabits per second, committed. Never a fraction: capacity is traded in whole Gbps. */
  readonly committedGbps: number;
  /** Whole gigabits per second, burstable above `committedGbps`. Never below it. */
  readonly burstGbps: number;
  /** Price per Gbps-month, in the currency's smallest unit. */
  readonly unitPrice: Money;
  /** An ISO 8601 instant. */
  readonly submittedAt: string;
}

/**
 * One observation of a pool's spot price.
 *
 * A series rather than a single spot price because a price with no history is a
 * number on a screen: an operator deciding whether to buy is asking whether it
 * is rising, and a single point cannot answer that.
 */
export interface SpotPoint {
  /**
   * Which pool this observation is for.
   *
   * On the point rather than around the series, because the series holds every
   * pool's history and the chart draws one line per pool. A panel switching pools
   * filters on this; without it the document would have to carry one series per
   * pool, and the rail selection — which is the pool id — would have nothing to
   * join against.
   */
  readonly pool: MarketPool;
  /** An ISO 8601 instant. */
  readonly at: string;
  readonly price: Money;
}

/**
 * One slice of the pie: how much of the committed capacity a pool accounts for.
 *
 * The volume travels beside the share rather than being left in the orders table,
 * because a percentage with nothing behind it cannot be checked. 35% of what?
 */
export interface VenueShare {
  readonly pool: MarketPool;
  /** Committed capacity on this pool, in whole gigabits per second. */
  readonly committedGbps: number;
  /** A whole percentage, and the whole set adds to 100 when there is volume to
   * share. An empty book is the one case where they add to 0, because there is no
   * volume and a pie showing 25% of nothing would be worse than an empty one.
   */
  readonly share: number;
}

/**
 * `market/book`: the resting orders.
 *
 * A book rather than a document about a book, so the headline figures and the rows
 * they were derived from are one payload. When `bestBid` sat in a document that also
 * carried venue shares and a price series, the numbers were fine and the answer was
 * not: a panel asking about the book had to receive the pie to get it.
 *
 * ## Why there is no spread
 *
 * Because the book spans four pools and they are priced on four different scales —
 * a CDN edge giga-month is an order of magnitude below a Mombasa corridor's. A
 * spread is the difference between *one* bid and *one* offer on *one* pool, and the
 * highest bid anywhere in this book belongs to a different pool from the lowest
 * offer anywhere in it, so subtracting them yields a negative number that reads as
 * a price and is not one.
 *
 * The field was there and the arithmetic was honest, which is the worst combination
 * available: `540_000 - 88_000` is a correct subtraction of two correct figures that
 * do not mean the same thing. A `null` would not have been better — it would have
 * said "no spread" about a book that has four of them. So the honest book-wide
 * figures are the two extremes stated as what they are, and the comparison an
 * operator actually wants is a row per pool, which `market/prices` already is.
 */
export interface MarketBook {
  /** The highest standing bid anywhere in the book, or `null` when nothing is bidding. */
  readonly bestBid: Money | null;
  /** The lowest standing offer anywhere in the book, or `null` when nothing is offered. */
  readonly bestOffer: Money | null;
  /** Every order's committed capacity, in whole gigabits per second. */
  readonly committedGbps: number;
  /** How many orders the book holds, both sides. */
  readonly openOrders: number;
  /** Which currency the book is quoted in. Every order is priced in this one. */
  readonly currency: Currency;
  readonly orders: MarketOrder[];
}

/** One pool's most recent observation, which is what a "prices" table lists per pool. */
export interface MarketQuote {
  readonly pool: MarketPool;
  readonly price: Money;
  /** An ISO 8601 instant. */
  readonly observedAt: string;
}

/**
 * `market/prices`: what each pool has been priced at, and the history behind it.
 *
 * `latest` is derived from `points` by the same query, so the table of current
 * prices cannot disagree with the lines drawn beneath it — which is the failure
 * the old document invited, when the headline price and the chart were two
 * fields filled by two queries.
 */
export interface PriceHistory {
  readonly currency: Currency;
  /** Every observation, every pool. The chart draws one line per pool. */
  readonly points: SpotPoint[];
  /** One entry per pool that has ever been observed. */
  readonly latest: MarketQuote[];
  /**
   * The direction the last observation moved, in whole percent.
   *
   * An integer rather than a percentage string so a panel cannot round it
   * differently from a table that shows the two prices it came from.
   */
  readonly changePct: number;
}

/**
 * `market/venues`: which pools the committed capacity actually sits on.
 *
 * Shares rather than percentages of the pools themselves: a pie of "how much
 * capacity is committed where", which is a different question from "what is it
 * priced at", and was previously answered by a chart sitting inside a table of
 * prices.
 */
export interface VenueBreakdown {
  readonly currency: Currency;
  /** Committed capacity across every pool, in whole gigabits per second. */
  readonly totalCommittedGbps: number;
  readonly venues: VenueShare[];
}

/**
 * Each pool's name, as an operator writes it.
 *
 * Keyed by the **value** a row carries rather than by the type's member name, and
 * typed `Record<MarketPool, string>` so adding a pool to the union without naming
 * it here is a compile error rather than an `undefined` beside a rail tab.
 */
export const MARKET_POOL_TITLES: Readonly<Record<MarketPool, string>> = {
  nairobi_ixp: "Nairobi IXP",
  mombasa_corridor: "Mombasa corridor",
  east_africa_subsea: "East Africa subsea",
  cdn_edge: "CDN edge",
};

/**
 * The trading pools, as a runtime list.
 *
 * Derived from the titles map above rather than written out beside it: a pool added
 * to the union without a title is already a compile error, because the map is a
 * `Record<MarketPool, string>`, and a second hand-written list would be a pool the
 * map knows about and this does not — which is a row whose `pool` filter chip does
 * not exist.
 *
 * Declared *after* the map it reads, which is the only reason the initialisation
 * order is worth a sentence: it is a `const` derived from another `const` in the
 * same module, so hoisting is not available and the reading has to be the one that
 * happens second.
 */
export const MARKET_POOLS: readonly MarketPool[] = Object.keys(
  MARKET_POOL_TITLES,
) as readonly MarketPool[];
