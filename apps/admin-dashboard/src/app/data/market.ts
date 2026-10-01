"use client";

import type {
  MarketBook,
  MarketOrder,
  MarketPool,
  MarketQuote,
  MarketSide,
  PriceHistory,
  SpotPoint,
  VenueBreakdown,
  VenueShare,
} from "@hewa/console-types";

import { useConsoleSection, type SectionStatus } from "../state/query";

/**
 * The `market` view's half of the console: three sections, three hooks.
 *
 * One hook per section rather than one per view, because a rail button is a
 * destination with its own endpoint now. `useMarketBook` and `usePriceHistory`
 * read different rows from different paths, and a single `useMarket` that fetched
 * all three would be a second place where "what is on screen" is decided.
 *
 * The market's sections are the one place in this console where the payload is a
 * document rather than a list, and that is why these hooks return `data` and not
 * `rows`: a book with no orders and a book that has not loaded are not the same
 * thing, and `undefined` is how the two stay apart.
 */

export type {
  MarketBook,
  MarketOrder,
  MarketPool,
  MarketQuote,
  MarketSide,
  PriceHistory,
  SpotPoint,
  VenueBreakdown,
  VenueShare,
};

export interface DocumentState<T> {
  readonly data: T | undefined;
  readonly status: SectionStatus;
  readonly refetch: () => void;
}

/** `market/book`: the resting orders. */
export function useMarketBook(): DocumentState<MarketBook> {
  const state = useConsoleSection("market/book");

  return { data: state.data, status: state.status, refetch: state.refetch };
}

/** `market/prices`: what each pool has been priced at, and the history behind it. */
export function usePriceHistory(): DocumentState<PriceHistory> {
  const state = useConsoleSection("market/prices");

  return { data: state.data, status: state.status, refetch: state.refetch };
}

/** `market/venues`: which pools the committed capacity actually sits on. */
export function useVenues(): DocumentState<VenueBreakdown> {
  const state = useConsoleSection("market/venues");

  return { data: state.data, status: state.status, refetch: state.refetch };
}
