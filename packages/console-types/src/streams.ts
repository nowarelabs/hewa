/**
 * The `streams` view: what is on screen.
 */
export interface Stream {
  readonly id: string;
  readonly title: string;
  readonly channel: string;
  /** A YouTube video id, embedded through `youtube-nocookie.com`. */
  readonly videoId: string;
}
