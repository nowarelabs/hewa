/**
 * The `flights` view: the airspace catalogue.
 *
 * `carrier` is on the record rather than derived from the callsign by the app. It
 * used to be a prefix table in the panel, which meant the operator saw a carrier
 * name the service had never been asked about, and a fourth prefix for the same
 * airline had to be added in two places to show up in one column. The airline is a
 * fact about the flight; a callsign convention is not a contract.
 */
export interface Flight {
  /** An ICAO 24-bit address, lower-case hex. Also the row's key. */
  readonly icao24: string;
  readonly callsign: string;
  readonly originCountry: string;
  readonly lat: number;
  readonly lng: number;
  /** Metres. */
  readonly altitude: number;
  /** Metres per second. */
  readonly velocity: number;
  /** Degrees true. */
  readonly heading: number;
  readonly isArriving: boolean;
  readonly isDeparting: boolean;
  /** The operator, as the summary bar and the rail both name it. */
  readonly carrier: string;
}
