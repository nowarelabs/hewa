import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createStore, createTickingStore } from "../src/app/state/store";

afterEach(() => {
  vi.useRealTimers();
});

describe("createStore", () => {
  test("holds one reference until set is called", () => {
    const store = createStore({ position: 0 });
    const snapshot = store.get();
    expect(store.get()).toBe(snapshot);
    store.set({ position: 1 });
    expect(store.get()).not.toBe(snapshot);
  });

  test("notifies every subscriber", () => {
    const store = createStore(0);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.subscribe(() => {
      calls += 1;
    });
    store.set(1);
    expect(calls).toBe(2);
    expect(store.size).toBe(2);
  });

  test("stops notifying after unsubscribe", () => {
    const store = createStore(0);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    unsubscribe();
    store.set(1);
    expect(calls).toBe(0);
    expect(store.size).toBe(0);
  });
});

describe("createTickingStore", () => {
  /**
   * The satellite list rendered its initial positions and never moved. The
   * ticker advanced the value through the inner store and notified a listener
   * set nobody had subscribed to, so `useSyncExternalStore` was told about a
   * change it was never told about. Nothing threw; the panel was simply wrong.
   */
  test("the timer notifies its subscribers", () => {
    vi.useFakeTimers();
    const store = createTickingStore(0, 1000, (current) => current + 1);
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.get()));

    vi.advanceTimersByTime(3000);

    expect(store.get()).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
    unsubscribe();
  });

  test("ticks once for any number of subscribers", () => {
    vi.useFakeTimers();
    const store = createTickingStore(0, 1000, (current) => current + 1);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.subscribe(() => {
      calls += 1;
    });

    vi.advanceTimersByTime(1000);

    expect(store.get()).toBe(1);
    expect(calls).toBe(2);
  });

  test("the timer outlives a collapsing panel but not the last one", () => {
    vi.useFakeTimers();
    const store = createTickingStore(0, 1000, (current) => current + 1);
    const first = store.subscribe(() => {});
    const second = store.subscribe(() => {});

    first();
    vi.advanceTimersByTime(1000);
    expect(store.get()).toBe(1);

    second();
    vi.advanceTimersByTime(5000);
    expect(store.get()).toBe(1);
    expect(store.size).toBe(0);
  });
});
