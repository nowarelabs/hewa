/**
 * The `satellites` view: the orbital catalogue.
 *
 * The view drifts these positions on a timer so the columns visibly move, so
 * these coordinates are not a measurement of anything.
 */

export type SatelliteKind =
  | "reconnaissance"
  | "weather"
  | "communication"
  | "navigation"
  | "scientific";

export interface Satellite {
  id: string;
  name: string;
  kind: SatelliteKind;
  lat: number;
  lng: number;
  altitudeKm: number;
  velocityKms: number;
}

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

export const KINDS: SatelliteKind[] = [
  "reconnaissance",
  "weather",
  "communication",
  "navigation",
  "scientific",
];
