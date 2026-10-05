import { describe, expect, test } from "vite-plus/test";
import { ALERT_CATEGORIES } from "@hewa/console-types";
import { RECEIVABLE_BUCKETS } from "@hewa/financial-dashboard-types";
import {
  ACCOUNT_TYPES,
  account,
  balancesFrom,
  indexAccounts,
  trialBalance,
} from "@hewa/ledger-accounting";
import { SLA_STATES, TRANSACTION_STATUSES, slaCommitment, slaState } from "@hewa/marketplace-types";
import { PAYOUT_STATUSES } from "@hewa/settlement-domain";

import { receivableBucket } from "../src/api-v1/finance/ageing.js";
import * as schema from "../src/db/schema.js";
import { EPOCH, seedRows } from "../src/db/seed.js";

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

  test("a bill's status is a status the column declares", () => {
    everyRowIsGrouped(
      rows.bills.map((bill) => bill.status),
      schema.billStatusEnum.enumValues,
      "bills",
    );
  });

  test("a credit's basis is a basis the column declares", () => {
    everyRowIsGrouped(
      rows.credits.map((credit) => credit.basis),
      schema.creditBasisEnum.enumValues,
      "credits",
    );
  });

  test("a payout's status is a status the column declares", () => {
    everyRowIsGrouped(
      rows.payouts.map((payout) => payout.status),
      schema.financePayoutStatusEnum.enumValues,
      "finance payouts",
    );
  });

  test("the finance payout status column is the domain's own list", () => {
    // Same reasoning as `transactionStatusEnum` above, and for the same reason: the
    // column cannot take `PAYOUT_STATUSES` directly because `pgEnum` wants a mutable
    // array. `assertPayoutTransition` decides which move is legal from this list, so
    // a payout status added to the domain and not to the column is a status this
    // service will refuse to write on a machine rather than in a build.
    expect([...schema.financePayoutStatusEnum.enumValues].sort()).toEqual(
      [...PAYOUT_STATUSES].sort(),
    );
  });

  test("the account type column is the domain's own list", () => {
    expect(schema.accountTypeEnum.enumValues).toEqual([...ACCOUNT_TYPES]);
  });

  test("a ledger account's type is a type the column declares", () => {
    everyRowIsGrouped(
      rows.ledgerAccounts.map((row_) => row_.type),
      schema.accountTypeEnum.enumValues,
      "ledger accounts",
    );
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

  test("every bill status, credit basis and payout status has a row, so no chip is dead", () => {
    // The other direction from `everyRowIsGrouped`, and the one the finance sections
    // need most: all three sections filter on exactly one of these, so a status the
    // seed leaves out is a chip that empties the table. A panel that renders its empty
    // state proves the query ran, not that it answered.
    const bills = new Set(rows.bills.map((bill) => bill.status));
    expect([...schema.billStatusEnum.enumValues].filter((status) => !bills.has(status))).toEqual(
      [],
    );

    const bases = new Set(rows.credits.map((credit) => credit.basis));
    expect([...schema.creditBasisEnum.enumValues].filter((basis) => !bases.has(basis))).toEqual([]);

    const statuses = new Set(rows.payouts.map((payout) => payout.status));
    expect([...PAYOUT_STATUSES].filter((status) => !statuses.has(status))).toEqual([]);
  });

  test("a bill's net total is the sum of its own three parts", () => {
    // The column is not stored and the panel computes it, so this is the assertion
    // that the fixture can be invoiced: `net_total_minor` is absent from
    // `finance_bills` on purpose, and a seed whose parts do not add up would produce
    // an invoice no reader could reconcile.
    for (const bill of rows.bills) {
      const total = bill.commitmentChargeMinor + bill.overageChargeMinor + bill.slaCreditMinor;
      expect(bill.commitmentChargeMinor, `${bill.id} commitment`).toBeGreaterThanOrEqual(0);
      expect(bill.overageChargeMinor, `${bill.id} overage`).toBeGreaterThanOrEqual(0);
      expect(bill.slaCreditMinor, `${bill.id} sla credit`).toBeLessThanOrEqual(0);
      expect(total, `${bill.id} totals`).toBeGreaterThan(0);
    }
  });

  test("a bill's month is the `YYYY-MM` its column checks", () => {
    for (const bill of rows.bills) {
      expect(bill.month, bill.id).toMatch(/^[0-9]{4}-[0-9]{2}$/);
      expect(daysIn(bill.month), `${bill.id} month`).toBeGreaterThanOrEqual(28);
    }
  });

  test("a credit is a reduction and it does not repeat its bill's SLA line", () => {
    const billsById = new Map(rows.bills.map((bill) => [bill.id, bill]));

    for (const credit of rows.credits) {
      const bill = billsById.get(credit.billId);
      expect(bill, `${credit.id} names no seeded bill`).toBeDefined();
      expect(credit.amountMinor, `${credit.id} amount`).toBeLessThanOrEqual(0);
      // `finance_credits` holds a decision taken *after* issue, so its figure is
      // additional to the invoice rather than a copy of the SLA line on it. A credit
      // equal to its bill's `sla_credit_minor` would be either a double count in
      // `revenue/receivables` or a row indistinguishable from a column, and the
      // receivables figure would depend on which the reader picked.
      expect(credit.amountMinor, `${credit.id} repeats ${bill?.id}'s sla credit`).not.toBe(
        bill?.slaCreditMinor,
      );
    }
  });

  test("a payout is a positive obligation, and it names a bill that was not withdrawn", () => {
    const billsById = new Map(rows.bills.map((bill) => [bill.id, bill]));

    for (const payout of rows.payouts) {
      expect(payout.amountMinor, `${payout.id} amount`).toBeGreaterThan(0);
      expect(payout.feeMinor, `${payout.id} fee`).toBeGreaterThanOrEqual(0);

      const bill = billsById.get(payout.reference);
      expect(bill, `${payout.id} names no seeded bill`).toBeDefined();
      // An obligation against a `void` bill is money owed for a month that was
      // withdrawn, which is a row that reads as owed and is not.
      expect(bill?.status, `${payout.id} settles a ${bill?.status} bill`).not.toBe("void");
    }
  });

  test("a bill is disputed or it has no dispute reason", () => {
    for (const bill of rows.bills) {
      expect(bill.disputeReason !== null, `${bill.id} reason`).toBe(bill.status === "disputed");
      if (bill.disputeReason !== null) {
        expect(bill.disputeReason.length, `${bill.id} reason is empty`).toBeGreaterThan(0);
      }
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

/**
 * The seeded ledger, folded through the domain package rather than read back.
 *
 * This is the one place the fixture's ledger is checked as a **book** rather than as
 * rows. `tests/finance.e2e.test.ts` asserts the section's own three columns agree
 * with each other, which is a check on the mapper; this asserts the postings are a
 * set of journal entries that balance and a trial balance that foots, which is a
 * check on the fixture. A seed that posted a revenue accrual with the sign of the
 * other side would satisfy every per-row assertion above and produce a revenue
 * account that grew by being debited.
 */
describe("the seeded ledger", () => {
  const accounts = rows.ledgerAccounts.map((row_) =>
    account(row_.id, row_.name, row_.type, row_.currency),
  );
  const currencies = new Map(accounts.map((row_) => [row_.id, row_.currency]));

  /** The entries the two flat lists make, which is the join the service performs. */
  const entries = rows.ledgerEntries.map((entry) => ({
    ...entry,
    postings: rows.ledgerPostings
      .filter((leg) => leg.entryId === entry.id)
      .map((leg) => ({
        accountId: leg.accountId,
        amountMinor: leg.amountMinor,
        currency: currencies.get(leg.accountId),
      })),
  }));

  test("every posting belongs to a seeded entry", () => {
    // The direction that catches a typo in a seed constant: an orphan leg loads fine,
    // because the foreign key is satisfied by *some* entry, and then it is a row no
    // entry read will ever return.
    const known = new Set(rows.ledgerEntries.map((entry) => entry.id));
    for (const leg of rows.ledgerPostings) {
      expect(known, `${leg.entryId} has a leg with no entry`).toContain(leg.entryId);
    }
  });

  test("every posting names an account in the chart", () => {
    const known = new Set(accounts.map((row_) => row_.id));
    for (const leg of rows.ledgerPostings) {
      expect(known, `${leg.accountId} is not in the chart`).toContain(leg.accountId);
    }
    // `indexAccounts` is the domain's own duplicate check, and a chart with two
    // accounts of one name and currency would be caught by the schema's unique index
    // rather than here — so this is about the service's own failure mode instead.
    expect(() => indexAccounts(accounts)).not.toThrow();
  });

  test("every entry has at least two legs and balances", () => {
    for (const entry of entries) {
      expect(entry.postings.length, `${entry.id} legs`).toBeGreaterThanOrEqual(2);
      const total = entry.postings.reduce((sum, leg) => sum + (leg.amountMinor ?? 0), 0);
      expect(total, `${entry.id} sums to ${total}`).toBe(0);
      for (const leg of entry.postings) {
        expect(leg.amountMinor, `${entry.id} has a zero posting`).not.toBe(0);
      }
    }
  });

  test("the trial balance foots", () => {
    // `trialBalance` sums the *raw* debits and credits across every entry, which is
    // the check that matters: summing normal-side balances would prove nothing,
    // because a revenue account's balance is positive precisely by being credited.
    const balance = trialBalance(
      entries.map((entry) => ({
        id: entry.id,
        reference: entry.reference,
        description: entry.description,
        occurredAt: entry.occurredAt.toISOString(),
        postings: entry.postings.map((leg) => ({
          accountId: leg.accountId,
          amount: { amountMinor: leg.amountMinor ?? 0, currency: "USD" },
        })),
      })),
      "USD",
    );

    expect(balance.debits.amountMinor - balance.credits.amountMinor, "trial balance").toBe(0);
    expect(balance.debits.amountMinor).toBeGreaterThan(0);
  });

  test("every account was posted to and ends with a non-zero balance", () => {
    const balances = new Map(
      balancesFrom(
        accounts,
        entries.map((entry) => ({
          id: entry.id,
          reference: entry.reference,
          description: entry.description,
          occurredAt: entry.occurredAt.toISOString(),
          postings: entry.postings.map((leg) => ({
            accountId: leg.accountId,
            amount: { amountMinor: leg.amountMinor ?? 0, currency: "USD" },
          })),
        })),
      ).map((row_) => [row_.accountId, row_.balance.amountMinor]),
    );

    for (const row_ of accounts) {
      const balance = balances.get(row_.id);
      expect(balance, `${row_.id} has no balance`).toBeDefined();
      // An account whose balance is always zero tells a reader nothing about whether
      // the fold ran, which is what this is here to catch.
      expect(balance, `${row_.id} is zero`).not.toBe(0);
    }
  });

  test("revenue was credited, not debited, and reads positive", () => {
    const revenue = accounts.filter((row_) => row_.type === "revenue");
    expect(revenue.length).toBeGreaterThan(0);

    const positive = rows.ledgerPostings
      .filter((leg) => revenue.some((row_) => row_.id === leg.accountId))
      .reduce((sum, leg) => sum + leg.amountMinor, 0);

    // Every accrual to a revenue account is a negative posting under this package's
    // convention, and the whole `ledger/ledger` section is wrong if it is not.
    expect(positive, "revenue's postings sum positive").toBeLessThan(0);
  });
});

/**
 * The ageing fixture and the rule that reads it.
 *
 * The buckets are the group vocabulary of `revenue/receivables`, so a bucket with no
 * row in it is a chip that filters to nothing — and the rule itself is spelled out
 * here rather than left to whatever the fixture happens to contain, because a fixture
 * with only comfortable cases would pass while the boundary at 30 was wrong.
 */
describe("the ageing fixture", () => {
  const epoch = new Date(EPOCH);

  test("the rule's boundaries are the ones the section documents", () => {
    expect(receivableBucket(-30)).toBe("current");
    expect(receivableBucket(0)).toBe("current");
    expect(receivableBucket(1)).toBe("d1_30");
    expect(receivableBucket(30)).toBe("d1_30");
    expect(receivableBucket(31)).toBe("d31_60");
    expect(receivableBucket(60)).toBe("d31_60");
    expect(receivableBucket(61)).toBe("d61_90");
    expect(receivableBucket(90)).toBe("d61_90");
    expect(receivableBucket(91)).toBe("d90_plus");
  });

  test("every bucket has an issued or disputed bill at the epoch", () => {
    const buckets = new Set(
      rows.bills
        .filter((bill) => bill.status === "issued" || bill.status === "disputed")
        .map((bill) =>
          receivableBucket(Math.trunc((epoch.getTime() - bill.dueAt.getTime()) / 86_400_000)),
        ),
    );

    expect([...RECEIVABLE_BUCKETS].filter((bucket) => !buckets.has(bucket))).toEqual([]);
  });
});

describe("the seeded attestations", () => {
  test("one row per city and day, and the day is a day of that month", () => {
    const keys = new Set<string>();

    for (const row of rows.attestations) {
      const key = `${row.city} ${row.month} ${row.day}`;
      expect(keys.has(key), `${key} is published twice`).toBe(false);
      keys.add(key);

      expect(row.month, row.id).toMatch(/^[0-9]{4}-[0-9]{2}$/);
      expect(row.day, `${row.id} day`).toBeGreaterThanOrEqual(1);
      expect(row.day, `${row.id} day`).toBeLessThanOrEqual(daysIn(row.month));
      expect(row.grossMinor, `${row.id} gross`).toBeGreaterThanOrEqual(0);
      expect(row.costsMinor, `${row.id} costs`).toBeGreaterThanOrEqual(0);
      // `gross - costs` is what the panel shows as the day's net, and the column pair
      // is the only place that subtraction exists.
      expect(row.grossMinor - row.costsMinor, `${row.id} net is negative`).toBeGreaterThan(0);
    }
  });

  test("one city is short a day, so both verdicts are on screen", () => {
    const byCity = new Map<string, Set<number>>();
    for (const row of rows.attestations) {
      const days = byCity.get(row.city) ?? new Set<number>();
      days.add(row.day);
      byCity.set(row.city, days);
    }

    const coverage = [...byCity.entries()].map(([city, days]) => [
      city,
      days.size >= daysIn(rows.attestations.find((row) => row.city === city)?.month ?? ""),
    ]);

    // Two complete cities and one short, in the same month. A verdict per month
    // would call that month complete and hide the shortfall, which is the reason the
    // verdict is judged per `(city, month)`.
    expect(coverage.filter(([, complete]) => complete)).toHaveLength(2);
    expect(coverage.filter(([, complete]) => !complete)).toHaveLength(1);
  });
});

/**
 * How many days a `YYYY-MM` month has, computed the way `records.ts` computes it.
 *
 * Duplicated here on purpose rather than imported: this is the fixture's own view of
 * a calendar, and a test that called the function under test to decide what the
 * fixture should contain would agree with a wrong implementation.
 */
function daysIn(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}
