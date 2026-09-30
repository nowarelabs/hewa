import type { Satellite, SatelliteKind } from "@hewa/console-types";

/**
 * Seed satellites for the console's `satellites` view.
 *
 * The coordinates are plausible and mean nothing. They were nudged by a timer in
 * the browser so the columns appeared to move; a value that is invented in a
 * `Math.random()` loop is not more live than one that is invented once and sent,
 * and it costs a timer, a store, and a second copy of these records.
 */

/**
 * Every kind the catalogue can hold, which is one more than the rail lists.
 *
 * The air console does not track `scientific` satellites, so it has no rail
 * entry, and a kind with no rail entry would otherwise be a row in the table that
 * no chip accounts for.
 */
export const SATELLITE_KINDS: SatelliteKind[] = [
  "reconnaissance",
  "weather",
  "communication",
  "navigation",
  "scientific",
];

export const SATELLITES: Satellite[] = [
  {
    id: "1",
    name: "Landsat 8",
    kind: "reconnaissance",
    lat: 1.2345,
    lng: 36.789,
    altitudeKm: 705,
    velocityKms: 7.5,
  },
  {
    id: "2",
    name: "Sentinel-2A",
    kind: "reconnaissance",
    lat: -0.5678,
    lng: 37.456,
    altitudeKm: 786,
    velocityKms: 7.6,
  },
  {
    id: "3",
    name: "ISS",
    kind: "scientific",
    lat: 0.1234,
    lng: 38.901,
    altitudeKm: 408,
    velocityKms: 7.66,
  },
  {
    id: "4",
    name: "Starlink-1234",
    kind: "communication",
    lat: 2.3456,
    lng: 39.123,
    altitudeKm: 550,
    velocityKms: 7.5,
  },
  {
    id: "5",
    name: "GPS IIF-1",
    kind: "navigation",
    lat: -1.8901,
    lng: 36.234,
    altitudeKm: 20200,
    velocityKms: 3.9,
  },
];
