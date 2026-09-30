"use client";

import type { Stream, StreamChannel } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The streams view's half of the console.
 *
 * The channels are the service's, and they arrive in `meta.groups` beside the
 * rows rather than being listed in the browser. This view used to carry a hard
 * coded list of five of them in the panel and five more in `shell.config.tsx`,
 * which between them named two channels the service was not holding and missed
 * four it was: the vocabulary is the service's, so a channel it stops offering
 * goes quiet rather than becoming an empty column.
 *
 * The selected channel is not here either. It used to be, in a module-scoped
 * store the player and the info column both read, and that store is gone: the
 * view no longer picks a channel, so nothing needs two panels to agree on one.
 */

export type { Stream };
export type { StreamChannel };

/**
 * What the view knows, and how it knows it.
 *
 * `rows` is `[]` before the first answer, and that is deliberate for a list: it is
 * the same empty value the filter produces, and `emptyMessage` is what tells the
 * two apart. A view whose data is not a list gets `undefined` for its `data`
 * instead, because there is no honest empty economy to offer.
 */
export interface StreamView {
  readonly rows: readonly Stream[];
  /**
   * The channels the service can hold, including any that have gone quiet.
   *
   * Typed as the contract's channels rather than as strings, so a chip in the
   * bar is looked up by a name that is known to exist.
   */
  readonly groups: readonly StreamChannel[];
  readonly status: ViewStatus;
  readonly refetch: () => void;
}

/** The channels the service is holding right now, and whether it has answered. */
export function useStreams(): StreamView {
  const state = useConsoleView("streams");

  return {
    rows: state.data ?? [],
    groups: state.groups,
    status: state.status,
    refetch: state.refetch,
  };
}
