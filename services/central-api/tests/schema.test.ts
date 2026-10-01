import { describe, expect, test } from "vite-plus/test";
import { ALERT_CATEGORIES } from "@hewa/console-types";
import { SLA_STATES, TRANSACTION_STATUSES, slaCommitment, slaState } from "@hewa/marketplace-types";

import * as schema from "../src/db/schema.js";
import { seedRows } from "../src/db/seed.js";

/**
 * The invariants the schema and the seed have to hold.
 *
 * These are properties of the data and its definitions, asserted once by whoever
 * owns them, in the service, rather than by a test in the app that has to import
 * the rows in order to check them.
 *
 * Most of them used to be asserted against literal arrays in this file, and the
 * migration from arrays to tables is what made them worth writing: an array can
 * only hold the rows it was written with, so the interesting question became "is
 * this group named anywhere" rather than "does this row land in a group". Both are
 * still asked, and the second is still one way round — a vocabulary entry with no
 * rows is legitimate, and it is the row that is missing from the vocabulary that
 * goes uncounted.
 */

/**
 * Every row is on a group the view names.
 *
 * One way round on purpose: a vocabulary entry with no rows is legitimate — every
 * `node_kind` and every `sla_state` has to be nameable before anything is on it,
 * which is the whole reason the bar builds chips from the vocabulary rather than
 * from the rows. It is the row that is missing from the vocabulary that the summary
 * bar would silently not count.
 */
function everyRowIsGrouped(rows: string[], vocabulary: readonly string[], name: string) {
  expect(vocabulary.length, `${name} has no group vocabulary`).toBeGreaterThan(0);

  for (const row of new Set(rows)) {
    expect(vocabulary, `${name} row "${row}" is not a declared group`).toContain(row);
  }
}

const rows = seedRows();

describe("the group vocabularies", () => {
  test("a node's kind is a kind the column declares", () => {
    everyRowIsGrouped(
      rows.nodes.map((node) => node.kind),
      schema.nodeKindEnum.enumValues,
      "infrastructure",
    );
  });

  test("a settlement's kind is a kind the column declares", () => {
    everyRowIsGrouped(
      rows.settlements.map((line) => line.kind),
      schema.settlementKindEnum.enumValues,
      "settlement",
    );
  });

  test("an order's side and pool are declared", () => {
    everyRowIsGrouped(
      rows.orders.map((order) => order.side),
      schema.marketSideEnum.enumValues,
      "market side",
    );
    everyRowIsGrouped(
      rows.orders.map((order) => order.pool),
      schema.marketPoolEnum.enumValues,
      "market pool",
    );
  });

  test("an alert's category and severity are declared", () => {
    everyRowIsGrouped(
      rows.alerts.map((alert) => alert.category),
      schema.alertCategoryEnum.enumValues,
      "alert category",
    );
    everyRowIsGrouped(
      rows.alerts.map((alert) => alert.severity),
      schema.alertSeverityEnum.enumValues,
      "alert severity",
    );
  });

  /**
   * The one list the schema cannot inherit, because `pgEnum` takes a mutable array
   * and `TRANSACTION_STATUSES` is `readonly`.
   *
   * So it is copied, and the copy is the only place in this workspace where a
   * transaction status could be added to one list and not the other. The symptom
   * would not be a build failure: it would be a settlement run that fails on the
   * first status nobody expected, on a machine, in production.
   */
  test("the transaction status column is the domain's own list", () => {
    expect([...schema.transactionStatusEnum.enumValues].sort()).toEqual(
      [...TRANSACTION_STATUSES].sort(),
    );
  });

  test("the sla state column is the domain's own list", () => {
    expect(schema.slaStateEnum.enumValues).toEqual([...SLA_STATES]);
  });
});

describe("the stored SLA states", () => {
  /**
   * The states are computed by the one function that defines the boundary and then
   * stored, so that a settlement run issuing a credit and a panel drawing a chip
   * read the same answer. This is where that claim is checked: the seed's rows are
   * compared against a fresh call for every one of them, so widening `AT_RISK_BPS`
   * or moving a boundary fails here rather than in an invoice.
   */
  test("every seeded state is what the shared rule says it should be", () => {
    for (const row of rows.monitors) {
      const expected = slaState(
        slaCommitment(row.targetBps, row.actualBps, row.creditNumerator, row.creditDenominator),
      );

      expect(row.state, `${row.id} is ${row.targetBps}/${row.actualBps} bps`).toBe(expected);
    }
  });

  /**
   * The boundary itself, spelled out rather than left to whatever the seed happens
   * to contain. A fixture that happened to include only comfortable cases would pass
   * the test above while the function was wrong at exactly one point, and that is
   * the point the function exists for.
   */
  test("the seeded rows straddle the at-risk boundary in both directions", () => {
    const states = new Set(rows.monitors.map((row) => row.state));

    expect(states).toEqual(new Set(SLA_STATES));
  });
});

describe("the seeded rows", () => {
  /**
   * Every alert category is present, because three of the four alert sections
   * filter on one.
   *
   * `alerts/outages` filters on `outage`, `alerts/capacity` on `capacity`,
   * `alerts/security` on `security`. A category the seed leaves out is a rail
   * destination that can only render its empty state, and an empty state proves the
   * query compiles rather than that it answers — so the section would look built
   * and be unexercised. This is the test that makes "the security section is blank"
   * a failure rather than a puzzle.
   */
  test("every alert category has at least one row", () => {
    const seeded = new Set(rows.alerts.map((alert) => alert.category));
    expect([...seeded].toSorted()).toEqual([...ALERT_CATEGORIES].toSorted());
  });

  /**
   * And at least one category has more than one row for one entity, because the
   * grouping sections exist to collapse repeats.
   *
   * `alertCount` and `worstSeverity` are the two columns that distinguish an
   * outage *group* from an outage row, and both are constant on a group of one. A
   * seed where every group has a single member cannot tell a rollup that summed
   * correctly from one that did not sum at all.
   */
  test("some entity carries more than one alert, so the grouped sections have something to group", () => {
    const counts = new Map<string, number>();
    for (const alert of rows.alerts) {
      counts.set(alert.category, (counts.get(alert.category) ?? 0) + 1);
    }
    expect(counts.get("outage"), "outage alerts").toBeGreaterThan(1);
    expect(counts.get("security"), "security alerts").toBeGreaterThan(1);

    const entities = new Map<string, Set<string>>();
    for (const alert of rows.alerts) {
      const seen = entities.get(alert.category) ?? new Set<string>();
      seen.add(alert.entityId);
      entities.set(alert.category, seen);
    }
    // Fewer entities than alerts in at least one grouped category: that is the
    // repeat the `outages` and `security` sections collapse.
    expect((entities.get("outage")?.size ?? 0) < (counts.get("outage") ?? 0)).toBe(true);
  });

  test("every figure is a whole number where the contract says it is", () => {
    // Capacity and utilisation are integers all the way down, because `(1 - 0.9) *
    // 100` is `9.999999999999998` and a basis-point boundary decided by a float is
    // a boundary that lands on the wrong side roughly once in a million queries.
    for (const node of rows.nodes) {
      expect(Number.isInteger(node.utilisationBps), node.id).toBe(true);
      expect(node.utilisationBps).toBeGreaterThanOrEqual(0);
      expect(node.utilisationBps).toBeLessThanOrEqual(10_000);
    }
    for (const order of rows.orders) {
      expect(Number.isInteger(order.committedGbps), order.id).toBe(true);
      expect(order.burstGbps, `${order.id} bursts below what it commits`).toBeGreaterThanOrEqual(
        order.committedGbps,
      );
    }
  });

  test("every money figure is a safe integer of minor units", () => {
    const amounts = [
      ...rows.orders.map((order) => order.priceMinor),
      ...rows.settlements.map((line) => line.amountMinor),
      ...rows.settlements.map((line) => line.feeMinor),
      ...rows.spots.map((spot) => spot.priceMinor),
    ];

    for (const amount of amounts) {
      expect(Number.isSafeInteger(amount), String(amount)).toBe(true);
    }
  });

  test("a fee is never negative and a credit stays negative", () => {
    for (const line of rows.settlements) {
      expect(line.feeMinor, `${line.id} fee`).toBeGreaterThanOrEqual(0);
    }

    const credits = rows.settlements.filter((line) => line.kind === "payout");
    expect(credits.length).toBeGreaterThan(0);
    for (const credit of credits) {
      expect(credit.amountMinor, `${credit.id} payout`).toBeLessThan(0);
    }
  });

  /**
   * The statuses that stopped value from moving all say why, and the statuses that
   * moved it say nothing.
   *
   * Both directions, because either one alone is satisfied by a column nobody fills.
   * `failed` and `reversed` are both here rather than `failed` alone: a reversal is
   * a thing that happened to a charge, so it has a cause the same way a failure
   * does — the value moved out and then came back, and an operator looking at the
   * row needs to know which of the two happened and why.
   *
   * The pair is worth this because the other direction is where the bug lives. An
   * empty string on a completed line renders as the same dash as a `null` on one
   * that never went wrong, and "nothing happened here" and "something happened here
   * and nobody wrote down what" are the same pixels and opposite facts.
   */
  test("a line that stopped says why, and a line that moved says nothing", () => {
    const stopped = new Set(["failed", "reversed"]);

    for (const line of rows.settlements) {
      if (stopped.has(line.status)) {
        expect(line.failureReason, `${line.id} is ${line.status} with no reason`).toBeTruthy();
      } else {
        expect(line.failureReason, `${line.id} is ${line.status} with a reason`).toBeNull();
      }
    }
  });

  test("every commitment names a node that exists", () => {
    // The foreign key enforces this in the database, so this is the assertion that
    // the fixture is *readable* as well as loadable: a seed that tripped the
    // constraint would fail `seedDatabase` with a message about a relation rather
    // than about the row that was wrong.
    const known = new Set(rows.nodes.map((node) => node.id));

    for (const monitor of rows.monitors) {
      expect(known, `${monitor.id} names an unknown node`).toContain(monitor.nodeId);
    }
  });

  test("an alert's entity is one the console can label", () => {
    const known = new Set([
      ...rows.nodes.map((node) => node.id),
      ...rows.orders.map((order) => order.id),
      ...rows.settlements.map((line) => line.id),
    ]);

    for (const alert of rows.alerts) {
      expect(known, `${alert.id} names an unknown entity`).toContain(alert.entityId);
      expect(alert.entityLabel, `${alert.id} has no label`).toBeTruthy();
    }
  });

  test("every node kind has a row, so no chip is dead", () => {
    // The other direction from `everyRowIsGrouped`, and the one the client owns. A
    // vocabulary entry with nothing on it is a chip an operator can press to see
    // nothing, which is a worse control than no chip; `node_kind` is small and fixed,
    // so this one is meant to be fully covered.
    const covered = new Set(rows.nodes.map((node) => node.kind));

    expect([...covered].sort()).toEqual([...schema.nodeKindEnum.enumValues].sort());
  });
});
