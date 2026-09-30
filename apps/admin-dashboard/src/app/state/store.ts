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
