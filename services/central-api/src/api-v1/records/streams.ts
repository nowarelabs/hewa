import type { Stream, StreamChannel } from "@hewa/console-types";

/**
 * The channels the console's `streams` view is holding.
 *
 * A vocabulary rather than something derived from the rows, so a filter chip for
 * a channel that has gone quiet is still there at zero instead of disappearing
 * and taking its control with it. `flights` does the same for its carriers.
 */
export const STREAM_CHANNELS: StreamChannel[] = [
  "citizen",
  "ktn",
  "aljazeera",
  "skynews",
  "ntv",
  "k24",
  "spice",
  "capital",
];

/**
 * Seed channels for the console's `streams` view.
 *
 * A title and a channel, and that is the whole record. It used to carry a
 * YouTube video id as well, which existed only for an `<iframe>` in the panel:
 * a third party's player embedded in an operations console, with the video id
 * travelling through the service to reach it. Nothing reads it now.
 */
export const STREAMS: Stream[] = [
  { id: "1", title: "Citizen TV Kenya", channel: "citizen" },
  { id: "2", title: "KTN News Live", channel: "ktn" },
  { id: "3", title: "Al Jazeera Live", channel: "aljazeera" },
  { id: "4", title: "Sky News Live", channel: "skynews" },
  { id: "5", title: "NTV Kenya Live", channel: "ntv" },
  { id: "6", title: "K24 LIVE", channel: "k24" },
  { id: "7", title: "Spice FM", channel: "spice" },
  { id: "8", title: "Capital FM", channel: "capital" },
];
