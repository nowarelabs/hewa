/**
 * The `flights` view: the table that turns a callsign into an operator.
 *
 * The rows come from the worker at `NEXT_PUBLIC_FLIGHTS_WORKER_URL`.
 */

/** Callsign prefixes on Kenyan domestic services. */
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

export const AIRLINE_CODES: Record<string, string | undefined> = {
  kenya: "KQ",
  jambo: "JMB",
  fly540: "FY",
  safarilink: "XK",
};
