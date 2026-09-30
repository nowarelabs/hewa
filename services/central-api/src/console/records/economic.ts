import type { EconomicSection, Economy, GdpPoint, Indicator, Sector } from "@hewa/console-types";

/**
 * Seed figures for the console's `economic` view.
 *
 * Every figure the view shows comes from this file, and each is written once. The
 * rail column and the headline cards used to hold separate literals for the same
 * quantities and had already drifted apart — the rail said GDP growth was 5.2% and
 * the card beside it said 5.1%, on the same screen, with nothing to reconcile
 * them. They are constants here and both read the constants.
 *
 * The values arrive as display strings, units and all. A figure's precision and
 * its unit are the service's decision; a browser that reformats a number it was
 * sent will eventually render a KES rate in a locale that writes it differently,
 * and the two screens will disagree again.
 */

const KES_PER_USD = 153.25;
const KES_CHANGE = 0.15;
const KES_PER_EUR = 168.2;
const KES_PER_GBP = 195.3;
const INFLATION = 6.8;
const GDP_GROWTH = 5.1;
const UNEMPLOYMENT = 12.8;
const LATEST_QUARTER_USD_B = 11.8;
const TRADE_BALANCE_USD_B = -2.4;
const NSE_20 = 1842.15;

export const INDICATORS: Indicator[] = [
  {
    id: "fx",
    label: "KES/USD",
    value: KES_PER_USD.toFixed(2),
    caption: `+${KES_CHANGE}%`,
    trend: "up",
  },
  {
    id: "cpi",
    label: "Inflation",
    value: `${INFLATION}%`,
    caption: "Year over year",
    trend: "down",
  },
  {
    id: "gdp",
    label: "GDP growth",
    value: `${GDP_GROWTH}%`,
    caption: "Q4 2025",
  },
  {
    id: "jobs",
    label: "Unemployment",
    value: `${UNEMPLOYMENT}%`,
    caption: "National rate",
  },
];

export const GDP_SERIES: GdpPoint[] = [
  { month: "Jan", value: 9.2 },
  { month: "Feb", value: 9.5 },
  { month: "Mar", value: 9.8 },
  { month: "Apr", value: 10.1 },
  { month: "May", value: 10.4 },
  { month: "Jun", value: 10.2 },
  { month: "Jul", value: 10.5 },
  { month: "Aug", value: 10.8 },
  { month: "Sep", value: 11.0 },
  { month: "Oct", value: 11.2 },
  { month: "Nov", value: 11.5 },
  { month: "Dec", value: 11.8 },
];

/**
 * The pie's slices.
 *
 * `value` is a percentage and the total is 100, because that is what a pie is
 * drawn from — a chart handed shares that do not add up to the whole draws a pie
 * with a missing wedge and no indication of which one.
 */
export const SECTOR_SHARE: Sector[] = [
  { name: "Agriculture", value: 35 },
  { name: "Services", value: 45 },
  { name: "Industry", value: 20 },
];

/**
 * The figures the rail column shows, one section per rail entry.
 *
 * `id` is what the panel looks the rail selection up by. The rail entry is app
 * configuration — which tabs exist and what icon they carry — and this is the data
 * behind them, so the two meet at the id and neither has to know the other's
 * labels.
 */
export const ECONOMY_SECTIONS: EconomicSection[] = [
  {
    id: "overview",
    title: "Overview",
    figures: [
      { label: "GDP growth", value: `${GDP_GROWTH}%` },
      { label: "Inflation", value: `${INFLATION}%` },
      { label: "Unemployment", value: `${UNEMPLOYMENT}%` },
    ],
  },
  {
    id: "currency",
    title: "Currency",
    figures: [
      { label: "KES/USD", value: KES_PER_USD.toFixed(2) },
      { label: "KES/EUR", value: KES_PER_EUR.toFixed(2) },
      { label: "KES/GBP", value: KES_PER_GBP.toFixed(2) },
    ],
  },
  {
    id: "gdp",
    title: "GDP",
    figures: [{ label: "Latest quarter", value: `${LATEST_QUARTER_USD_B} B USD` }],
  },
  {
    id: "trade",
    title: "Trade",
    figures: [{ label: "Balance", value: `${TRADE_BALANCE_USD_B} B USD` }],
  },
  {
    id: "markets",
    title: "Markets",
    figures: [{ label: "NSE 20", value: NSE_20.toLocaleString("en-US") }],
  },
];

export const ECONOMY: Economy = {
  indicators: INDICATORS,
  gdpSeries: GDP_SERIES,
  sectors: SECTOR_SHARE,
  sections: ECONOMY_SECTIONS,
};
