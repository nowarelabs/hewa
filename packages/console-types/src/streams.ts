/**
 * The `streams` view: what is on screen.
 */

/**
 * The channels a stream can be on, which is what this view groups by.
 *
 * This view's vocabulary was `never`, on the reasoning that a stream is
 * identified by its outlet and so there was no second axis to offer. But the
 * outlet *is* the axis, and refusing to name it left the view with a filter bar
 * that could not act on anything and a rail that filtered on channel names
 * living only in the browser — two of which the service was not holding. The
 * same `Stream` now reads through {@link StreamChannel}, so a channel the
 * service does not offer is a build failure rather than an empty column.
 */
export type StreamChannel =
  | "citizen"
  | "ktn"
  | "aljazeera"
  | "skynews"
  | "ntv"
  | "k24"
  | "spice"
  | "capital";

export interface Stream {
  readonly id: string;
  readonly title: string;
  readonly channel: StreamChannel;
}
