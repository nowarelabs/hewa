/**
 * The `satellites` view: the orbital catalogue.
 */
export type SatelliteKind =
  | "reconnaissance"
  | "weather"
  | "communication"
  | "navigation"
  | "scientific";

export interface Satellite {
  readonly id: string;
  readonly name: string;
  readonly kind: SatelliteKind;
  readonly lat: number;
  readonly lng: number;
  readonly altitudeKm: number;
  readonly velocityKms: number;
}
