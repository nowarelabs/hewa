import { describe, expect, test } from "vite-plus/test";
import {
  CONSOLE_VIEWS,
  consolePath,
  type ConsoleGroups,
  type ConsolePayload,
  type ConsoleViewKey,
} from "../src/index.ts";

/**
 * The contract's own internal consistency.
 *
 * A types-only package has very little to assert at runtime, so this is mostly
 * about the two places a hand-written list can lie: the views named in
 * `CONSOLE_VIEWS` and the views typed in `ConsolePayload`. They are written out
 * separately — one has to be, because a type is erased — and the app's
 * `tests/data.test.ts` and the service's e2e test each hold one end of the pair.
 * This holds them together at build time, so the disagreement is a failed type
 * check rather than a 404.
 */

const typed: Record<ConsoleViewKey, keyof ConsolePayload> = {
  alerts: "alerts",
  conflicts: "conflicts",
  economic: "economic",
  flights: "flights",
  osint: "osint",
  satellites: "satellites",
  streams: "streams",
};

/**
 * The other direction.
 *
 * Without this, a key added to `ConsolePayload` and forgotten in `CONSOLE_VIEWS`
 * is a payload no view can name and nothing complains: `typed` satisfies its
 * annotation with the extra key simply absent, because a `Record` annotation
 * checks the keys that are there.
 */
const viewed: Record<keyof ConsolePayload, ConsoleViewKey> = typed;

describe("the console's views", () => {
  test("the payload map and the view list name the same seven", () => {
    expect(Object.keys(typed).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
    expect(Object.keys(viewed).toSorted()).toEqual([...CONSOLE_VIEWS].toSorted());
  });

  test("a view is listed once", () => {
    expect(new Set(CONSOLE_VIEWS).size).toBe(CONSOLE_VIEWS.length);
  });
});

describe("consolePath", () => {
  test("a view's endpoint hangs off the console prefix", () => {
    expect(consolePath("alerts")).toBe("/console/alerts");
    expect(consolePath("streams")).toBe("/console/streams");
  });

  test("every view has a path, and no two share one", () => {
    const paths = CONSOLE_VIEWS.map(consolePath);
    expect(new Set(paths).size).toBe(CONSOLE_VIEWS.length);
  });
});

describe("the views that group by nothing", () => {
  /**
   * `economic` counts figures and `streams` lists channels, so neither has a
   * group vocabulary. `never` is the honest annotation for that: a chip built
   * from their groups does not compile, where `string[]` would compile into an
   * empty bar that reads as "still loading" on a view that has nothing to load.
   */
  test("their group list holds no group at all", () => {
    const groups: ConsoleGroups<"economic"> = [];
    const alsoGroups: ConsoleGroups<"streams"> = [];
    expect([...groups, ...alsoGroups]).toEqual([]);
  });
});
