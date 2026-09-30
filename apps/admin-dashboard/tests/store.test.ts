import { describe, expect, test } from "vite-plus/test";
import { createStore } from "../src/app/state/store";

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
  });
});

/**
 * `createTickingStore` used to live here, and this file used to be the proof that
 * it worked: a timer advancing a value, notifying its subscribers, and stopping
 * when the last panel collapsed.
 *
 * It is gone because nothing ticks any more. The flights view used to drift its
 * positions on a five-second interval and the satellites view its orbits, so that
 * the columns would look as though they were moving — while `Math.random()`
 * supplied a number nobody had observed and a "Updated" line reported a change
 * that had not happened. Both views now read their rows from central-api.
 *
 * The two bugs that store had were real and are worth remembering, because a
 * future live view will want a timer again: it once kept a second listener set
 * and handed out the inner `set`, so it advanced the value and notified nobody,
 * and the satellite list silently rendered its initial positions. The other was
 * three mounted panels meaning three intervals writing to three copies of the
 * same data.
 */
