"use client";

import type {
  BandwidthMarket,
  MarketFigure,
  MarketOrder,
  MarketPool,
  MarketSection,
  MarketSide,
  SpotPoint,
  VenueShare,
} from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The market view's half of the console.
 *
 * The market is a document rather than a list: headline figures, the price
 * series, venue shares, rail sections, and the full book travel together. The
 * other four views are grouped lists, so this module mirrors that shape.
 */

export type {
  BandwidthMarket,
  MarketFigure,
  MarketOrder,
  MarketPool,
  MarketSection,
  MarketSide,
  SpotPoint,
  VenueShare,
};

export interface MarketView {
  readonly data: BandwidthMarket | undefined;
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The market the service is holding right now, and whether it has answered. */
export function useMarket(): MarketView {
  const state = useConsoleView("market");

  return {
    data: state.data,
    status: state.status,
    refetch: state.refetch,
  };
}
