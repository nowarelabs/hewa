"use client";

import { useSyncExternalStore } from "react";

/**
 * The smallest store that can hold state two panels need to agree on.
 *
 * The shell renders the left column, the middle column, and the right column as
 * siblings, so there is no parent component to own state they both read. The
 * two ways out are lifting it into a provider above `<AppShell>`, which puts
 * app wiring in the way of a config-only app, or a module-scoped store.
 *
 * This file is not a view and lives outside `panels/` for that reason. The
 * state it holds is per-view and sits in the view module that owns it: the
 * satellite catalogue is in `panels/satellites.tsx`, the selected channel in
 * `panels/streams.tsx`. What is here is the mechanism, not the data.
 *
 * `get` must return the same reference until `set` is called, because
 * `useSyncExternalStore` compares snapshots by identity and re-renders forever on
 * a fresh object.
 */
export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
  /** Live subscriber count. Exposed so a ticking store can own its timer. */
  readonly size: number;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get size() {
      return listeners.size;
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/**
 * A store that advances on a timer, with the timer owned by the subscribers.
 *
 * Each of these used to be a `useEffect` per panel, so three mounted panels
 * meant three intervals writing to three copies of the same data, and the list
 * on the left and the table in the middle showed different positions for the
 * same satellite. The interval starts with the first subscriber and stops with
 * the last, so a collapsed panel stops costing anything.
 *
 * This decorates a single store rather than holding one of its own. The first
 * version kept a second listener set and handed out the inner `set`, so the
 * timer advanced the value and notified nobody: the satellite list rendered its
 * initial positions and never moved, with no error to explain it. There is now
 * one value and one listener set, which is the only way that bug cannot come
 * back.
 */
export function createTickingStore<T>(
  initial: T,
  intervalMs: number,
  advance: (current: T) => T,
): Store<T> {
  const store = createStore<T>(initial);
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    get: store.get,
    set: store.set,
    get size() {
      return store.size;
    },
    subscribe: (listener: () => void) => {
      const unsubscribe = store.subscribe(listener);
      if (store.size === 1) {
        timer = setInterval(() => {
          store.set(advance(store.get()));
        }, intervalMs);
      }
      return () => {
        unsubscribe();
        if (store.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}
