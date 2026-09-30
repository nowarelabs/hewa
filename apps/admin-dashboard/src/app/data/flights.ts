/**
 * The `flights` view: the catalogue, and the table that turns a callsign into an
 * operator.
 *
 * The view drifts these positions on a timer so the columns visibly move, so
 * these coordinates are not a measurement of anything.
 */

export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  latitude: number;
  longitude: number;
  /** Metres. */
  altitude: number;
  /** Metres per second. */
  velocity: number;
  /** Degrees true. */
  heading: number;
  isArriving: boolean;
  isDeparting: boolean;
}

export const FLIGHTS: Flight[] = [
  {
    icao24: "4ca1d2",
    callsign: "KQ100",
    originCountry: "Kenya",
    latitude: 2.184,
    longitude: 35.442,
    altitude: 11582,
    velocity: 248,
    heading: 312,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "4ca305",
    callsign: "KQ310",
    originCountry: "Kenya",
    latitude: -2.874,
    longitude: 38.561,
    altitude: 3048,
    velocity: 210,
    heading: 134,
    isArriving: true,
    isDeparting: false,
  },
  {
    icao24: "4ca788",
    callsign: "KQ480",
    originCountry: "Kenya",
    latitude: 0.412,
    longitude: 34.921,
    altitude: 10973,
    velocity: 245,
    heading: 92,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "068d1a",
    callsign: "JM8200",
    originCountry: "Kenya",
    latitude: 0.884,
    longitude: 34.612,
    altitude: 10668,
    velocity: 232,
    heading: 268,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "068e44",
    callsign: "JM8215",
    originCountry: "Kenya",
    latitude: -1.402,
    longitude: 36.891,
    altitude: 2743,
    velocity: 195,
    heading: 47,
    isArriving: false,
    isDeparting: true,
  },
  {
    icao24: "06b1c2",
    callsign: "JB3200",
    originCountry: "Kenya",
    latitude: -0.877,
    longitude: 36.104,
    altitude: 10363,
    velocity: 228,
    heading: 203,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "048f31",
    callsign: "FY312",
    originCountry: "Kenya",
    latitude: -0.238,
    longitude: 35.104,
    altitude: 9144,
    velocity: 210,
    heading: 18,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "048e77",
    callsign: "5F401",
    originCountry: "Kenya",
    latitude: -0.041,
    longitude: 34.702,
    altitude: 2438,
    velocity: 180,
    heading: 176,
    isArriving: true,
    isDeparting: false,
  },
  {
    icao24: "064b90",
    callsign: "FL8110",
    originCountry: "Kenya",
    latitude: 0.533,
    longitude: 35.278,
    altitude: 8839,
    velocity: 215,
    heading: 224,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "064c3a",
    callsign: "FLC611",
    originCountry: "Kenya",
    latitude: 1.104,
    longitude: 36.712,
    altitude: 3658,
    velocity: 190,
    heading: 301,
    isArriving: false,
    isDeparting: true,
  },
  {
    icao24: "06a2f8",
    callsign: "XK621",
    originCountry: "Kenya",
    latitude: -3.204,
    longitude: 38.884,
    altitude: 10058,
    velocity: 240,
    heading: 161,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "06a311",
    callsign: "XK450",
    originCountry: "Kenya",
    latitude: -3.921,
    longitude: 39.564,
    altitude: 1829,
    velocity: 175,
    heading: 21,
    isArriving: true,
    isDeparting: false,
  },
  {
    icao24: "89640d",
    callsign: "QTR1369",
    originCountry: "Qatar",
    latitude: 3.612,
    longitude: 40.884,
    altitude: 11097,
    velocity: 252,
    heading: 341,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "800f52",
    callsign: "UGA410",
    originCountry: "Uganda",
    latitude: 0.204,
    longitude: 33.981,
    altitude: 10058,
    velocity: 235,
    heading: 182,
    isArriving: false,
    isDeparting: false,
  },
  {
    icao24: "70bd21",
    callsign: "ETH302",
    originCountry: "Ethiopia",
    latitude: 2.884,
    longitude: 39.104,
    altitude: 10973,
    velocity: 246,
    heading: 196,
    isArriving: false,
    isDeparting: false,
  },
];

/** Callsign prefixes as they appear on Kenyan domestic services. */
const AIRLINES: Record<string, string> = {
  KQ: "Kenya Airways",
  JM: "Jambojet",
  JB: "Jambojet",
  FY: "Fly540",
  "5F": "Fly540",
  FL: "Safarilink",
  FLC: "Safarilink",
  XK: "Safarilink",
};

export function airlineFor(callsign: string): string {
  return AIRLINES[callsign.slice(0, 2).toUpperCase()] ?? "Unknown";
}

/** Every carrier the summary bar names. "Unknown" is one of them. */
export const CARRIERS = [...new Set([...Object.values(AIRLINES), "Unknown"])];
