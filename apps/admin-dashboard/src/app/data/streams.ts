"use client";

import type { Stream } from "@hewa/console-types";

import { useConsoleView, type ViewStatus } from "../state/query";

/**
 * The streams view's half of the console.
 *
 * The selected channel is not here. It is per-view state that belongs to the
 * view, so it lives in `panels/streams.tsx` — see the store in `state/store.ts`
 * for why it is a module-scoped store and not a hook.
 *
 * The channels are the service's. Nothing in this view groups by them, so the
 * response's vocabulary is empty and that is honest rather than a gap.
 */

export type { Stream };

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
   * Nothing in this view groups, so this is empty.
   *
   * It is still here and still typed, because a view that groups by nothing and a
   * view that has not loaded yet both send an empty array, and only one of them
   * means there is nothing to offer.
   */
  readonly groups: readonly string[];
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
