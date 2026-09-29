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
 * `get` must return the same reference until `set` is called, because
 * `useSyncExternalStore` compares snapshots by identity and re-renders forever on
 * a fresh object.
 */
export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
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
 */
export interface TickingStore<T> extends Store<T> {
  /** Number of mounted subscribers. Exposed for tests. */
  readonly subscribers: number;
}

export function createTickingStore<T>(
  initial: T,
  intervalMs: number,
  advance: (current: T) => T,
): TickingStore<T> {
  const store = createStore<T>(initial);
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    get: store.get,
    set: store.set,
    get subscribers() {
      return listeners.size;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        timer = setInterval(() => {
          store.set(advance(store.get()));
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}
