/**
 * The `streams` view: what is on screen.

Records for the panels beside them.
 */

export interface Stream {
  id: string;
  title: string;
  channel: string;
  videoId: string;
}

export const STREAMS: Stream[] = [
  {
    id: "1",
    title: "Citizen TV Kenya",
    channel: "citizen",
    videoId: "XaAGe0YGOgI",
  },
  { id: "2", title: "KTN News Live", channel: "ktn", videoId: "dl_-tX3lCto" },
  {
    id: "3",
    title: "Al Jazeera Live",
    channel: "aljazeera",
    videoId: "gCNeDWCI0vo",
  },
  {
    id: "4",
    title: "Sky News Live",
    channel: "skynews",
    videoId: "YDvsBbKfLPA",
  },
  { id: "5", title: "NTV Kenya Live", channel: "ntv", videoId: "ZRDjGXNezw" },
  { id: "6", title: "K24 LIVE", channel: "k24", videoId: "d0BlPe6TyEg" },
  { id: "7", title: "Spice FM", channel: "spice", videoId: "GtVUMmPmv9s" },
  { id: "8", title: "Capital FM", channel: "capital", videoId: "9dTw7h1LdlE" },
];
