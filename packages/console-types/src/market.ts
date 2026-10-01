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

/** One slice of the pie: how much of the traded volume a pool accounts for. */
export interface VenueShare {
  readonly pool: MarketPool;
  /** A whole percentage, and the whole set adds to 100 when there is volume to
   * share. An empty book is the one case where they add to 0, because there is no
   * volume and a pie showing 25% of nothing would be worse than an empty one.
   */
  readonly share: number;
}

/** A label and a figure, for the rail column's key/value rows. */
export interface MarketFigure {
  readonly label: string;
  /** Already formatted, units included, and formatted by the shared formatter. */
  readonly value: string;
}

/**
 * One pool's figures, which the rail column picks between.
 *
 * `id` is looked up from the rail selection, so the panel resolves a stale id to
 * its fallback rather than rendering nothing. `title` is the pool's own name
 * rather than the rail entry's, because the two are allowed to differ — a rail
 * tab says "Subsea" because that is what fits in an icon rail.
 */
export interface MarketSection {
  readonly id: MarketPool;
  readonly title: string;
  readonly figures: MarketFigure[];
}

/**
 * The market, as the console shows it.
 *
 * The headline figures are typed rather than pre-formatted — `bestBid` is a
 * {@link Money}, not `"$4,120.00"` — because they are aggregates that have to be
 * comparable, sumable and re-derived by whoever disputes them, and a string
 * cannot be summed. The rail's figures *are* pre-formatted, because they are
 * labels beside a value and nothing downstream does arithmetic on them.
 */
export interface BandwidthMarket {
  /** The highest standing bid, in minor units. `null` when nothing is bidding. */
  readonly bestBid: Money | null;
  /** The lowest standing offer, in minor units. `null` when nothing is offered. */
  readonly bestOffer: Money | null;
  /** Every order's committed capacity, in whole gigabits per second. */
  readonly committedGbps: number;
  /** How many orders the book holds, both sides. */
  readonly openOrders: number;
  /** Which currency the book is quoted in. Every order is priced in this one. */
  readonly currency: Currency;
  readonly priceSeries: SpotPoint[];
  readonly venues: VenueShare[];
  readonly sections: MarketSection[];
  readonly book: MarketOrder[];
}

/**
 * Each pool's name, as an operator writes it.
 *
 * Keyed by the **value** a row carries rather than by the type's member name, and
 * typed `Record<MarketPool, string>` so adding a pool to the union without naming
 * it here is a compile error rather than a `undefined` beside a rail tab.
 *
 * It lives beside the type rather than in the panel because the service sends the
 * section title in the payload: `MarketSection.title` is the pool's own name, so a
 * stale rail selection resolves to the section that names itself, and no panel has
 * to carry a second copy of the vocabulary to render one.
 */
export const MARKET_POOL_TITLES: Readonly<Record<MarketPool, string>> = {
  nairobi_ixp: "Nairobi IXP",
  mombasa_corridor: "Mombasa corridor",
  east_africa_subsea: "East Africa subsea",
  cdn_edge: "CDN edge",
};
