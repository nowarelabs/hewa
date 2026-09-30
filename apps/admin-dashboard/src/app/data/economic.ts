/**
 * The `economic` view: national indicators.

Figures for the panels beside them.

The indicators carry a label, a value, a caption and which way the figure is
moving. The colours they used to carry are in the panel, because a Tailwind
class is how this app says something, not a fact about Kenya, and an endpoint
cannot send one.
 */

export interface Indicator {
  id: string;
  label: string;
  value: string;
  caption: string;
  trend?: "up" | "down";
}

const KES_PER_USD = 153.25;
const KES_CHANGE = 0.15;
const INFLATION = 6.8;
const GDP_GROWTH = 5.1;
const UNEMPLOYMENT = 12.8;

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

export const GDP_SERIES = [
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

export const SECTORS = [
  { name: "Agriculture", value: 35 },
  { name: "Services", value: 45 },
  { name: "Industry", value: 20 },
];
