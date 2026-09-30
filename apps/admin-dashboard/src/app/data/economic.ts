"use client";

import type { EconomicSection, Economy, GdpPoint, Indicator, Sector } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The economic view's half of the console.
 *
 * The one view that is not a list, so its `data` is the whole figure set: the
 * headline cards, the series behind the chart, the pie's slices, and the figures
 * each rail section shows.
 *
 * Those last two used to be a second set of literals held in this app, and they
 * had already drifted — the rail said GDP growth was 5.2% while the card beside
 * it said 5.1%, on the same screen, with nothing to reconcile them. There is now
 * one place they come from and one value each.
 */

export type { EconomicSection, Economy, GdpPoint, Indicator, Sector };

export interface EconomyView {
  /**
   * The figures, or `undefined` before the service has answered.
   *
   * Not `[]`, and not an `Economy` with nothing in it. Every other view's empty
   * value is an empty list, which is a claim about a list; here the empty value
   * would be four empty shapes, and drawing two charts over an empty series says
   * the economy is flat rather than that nothing arrived. So this one view says
   * it does not know yet, and the panel renders a line about that.
   */
  readonly data: Economy | undefined;
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The figures the service is holding right now, and whether it has answered. */
export function useEconomy(): EconomyView {
  const state = useConsoleView("economic");

  return { data: state.data, status: state.status, refetch: state.refetch };
}

/**
 * The figures for one rail section.
 *
 * A rail entry with no section behind it has no figures rather than a section of
 * blanks. That is a different thing from an economy with no figures in it, and
 * the panel says which of the two it is looking at.
 */
export function figuresFor(
  sections: readonly EconomicSection[],
  id: string,
): readonly { label: string; value: string }[] {
  return sections.find((section) => section.id === id)?.figures ?? [];
}
