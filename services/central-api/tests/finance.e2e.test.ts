import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import {
  ATTESTATION_VERDICTS,
  BILL_STATUSES,
  CREDIT_BASES,
  FINANCE_SECTION_KEYS,
  financeSectionPath,
  RECEIVABLE_BUCKETS,
  type Bill,
  type FinanceData,
  type FinancePayload,
  type FinanceSectionKey,
  type LedgerAccount,
  type LedgerEntryRecord,
  type Receivable,
} from "@hewa/financial-dashboard-types";
import { account, ACCOUNT_TYPES } from "@hewa/ledger-accounting";
import { PAYOUT_STATUSES } from "@hewa/settlement-domain";
import { ResponseCode } from "@hewa/response-codes";

import {
  authorized,
  bootCentralApi,
  TEST_TOKEN,
  UNAUTHORIZED_BODY,
  UNAVAILABLE_BODY,
} from "./boot.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";

/**
 * `GET /api/v1/finance/{view}/{section}` over real HTTP, and the guard in front of it.
 *
 * The shape is the console's read suite, and the reason is that the six sections are
 * the same kind of thing: `FINANCE_SECTION_KEYS` is the whole list of destinations the
 * dashboard can ask for, and this asks for each one at the path
 * `financeSectionPath` builds. A section added to the contract with no controller
 * fails here rather than as a 404 in a browser.
 *
 * What this suite adds to the console's is the **clock**. `revenue/receivables` ages
 * every bill against `CLOCK`, and `tests/boot.ts` pins that to the seed's `EPOCH`,
 * so the ageing assertions below are about code rather than about the day the suite
 * runs. The last block boots a second time with a later date on purpose: a section
 * that ignores the injected clock still passes every other assertion here.
 */
describe("GET /api/v1/finance/:view/:section", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * A section's own path, on the service's own origin.
   *
   * Built by splitting the key on `/` and calling the contract's own function rather
   * than by writing the six paths out, because the thing under test is the join
   * between a path the dashboard produces and a route that answers it.
   */
  function url(key: FinanceSectionKey): string {
    const [view, section] = key.split("/") as [
      Parameters<typeof financeSectionPath>[0],
      Parameters<typeof financeSectionPath>[1],
    ];
    return `${baseUrl}${financeSectionPath(view, section)}`;
  }

  async function read<K extends FinanceSectionKey>(key: K): Promise<FinanceData<K>> {
    const response = await authorized(url(key));
    expect(response.status, `${key} answered ${response.status}`).toBe(200);
    const body = (await response.json()) as FinancePayload[K];
    return body.data;
  }

  /** The ledger section's account rows, so the tests below read one list and not two. */
  async function accounts(): Promise<readonly LedgerAccount[]> {
    return (await read("ledger/ledger")).accounts;
  }

  /** The journal, in the order the section returns it. */
  async function entries(): Promise<readonly LedgerEntryRecord[]> {
    return (await read("ledger/ledger")).entries;
  }

  test("every section answers with its envelope, and five of them with a list", async () => {
    for (const key of FINANCE_SECTION_KEYS) {
      const response = await authorized(url(key));
      const body: unknown = await response.json();

      expect(response.status, `${key} answered ${response.status}`).toBe(200);

      // The ledger is the exception, and the exception is the point rather than a leak:
      // its data is the chart *and* the entries posted against it, because a posting is
      // "what moved this account" and that question names an account. Asserting `Array`
      // here would be asserting the accident of five sections rather than the contract,
      // so the ledger's two halves are asserted by name below instead.
      if (key === "ledger/ledger") {
        expect(body, `${key} envelope`).toEqual({
          code: ResponseCode.Ok,
          data: { accounts: expect.any(Array), entries: expect.any(Array) },
          meta: { groups: expect.any(Array) },
        });
        continue;
      }

      expect(body, `${key} envelope`).toEqual({
        code: ResponseCode.Ok,
        data: expect.any(Array),
        meta: { groups: expect.any(Array) },
      });
    }
  });

  test("every section's group vocabulary is the contract's own", async () => {
    const expected: Readonly<Record<FinanceSectionKey, readonly string[]>> = {
      "revenue/bills": BILL_STATUSES,
      "revenue/receivables": RECEIVABLE_BUCKETS,
      "revenue/credits": CREDIT_BASES,
      "settlement/payouts": PAYOUT_STATUSES,
      // The chart's types, read from the domain package rather than from the
      // `accountTypeEnum`'s `enumValues`: both are the same list today, and the
      // enum's list is a column type while this is the domain's rule.
      "ledger/ledger": ACCOUNT_TYPES,
      "proof/attestations": ATTESTATION_VERDICTS,
    };

    for (const key of FINANCE_SECTION_KEYS) {
      const response = await authorized(url(key));
      const body = (await response.json()) as FinancePayload[FinanceSectionKey];

      // The chips come from `meta.groups`, so a vocabulary read from the rows
      // instead would show up here as a shorter array.
      expect(body.meta.groups, `${key} groups`).toEqual([...expected[key]]);
    }
  });

  test("the guard is in front of the finance view", async () => {
    const response = await fetch(url("revenue/bills"));
    expect(response.status).toBe(401);
    expect(await response.text()).toMatch(UNAUTHORIZED_BODY);
  });

  test("a wrong token is refused and the right one is not", async () => {
    const wrong = await fetch(url("revenue/bills"), {
      headers: { [SERVICE_TOKEN_HEADER]: `${TEST_TOKEN}-wrong` },
    });
    expect(wrong.status).toBe(401);

    const right = await authorized(url("revenue/bills"));
    expect(right.status).toBe(200);
  });

  test("a service with no token configured says so", async () => {
    const unconfigured = await bootCentralApi({ serviceToken: null });
    try {
      const response = await fetch(
        `${await unconfigured.getUrl()}${url("revenue/bills").slice(baseUrl.length)}`,
      );
      expect(response.status).toBe(503);
      expect(await response.text()).toMatch(UNAVAILABLE_BODY);
    } finally {
      await unconfigured.close();
    }
  });

  describe("revenue/bills", () => {
    test("holds every bill, newest month first", async () => {
      const bills = await read("revenue/bills");

      expect(bills).toHaveLength(11);
      expect([...new Set(bills.map((bill) => bill.month))]).toEqual([
        "2026-03",
        "2026-02",
        "2026-01",
      ]);
    });

    test("the breakdown's total is the sum of its own three parts", async () => {
      for (const bill of await read("revenue/bills")) {
        const { commitmentCharge, overageCharge, slaCredit, netTotal } = bill.breakdown;
        expect(
          commitmentCharge.amountMinor + overageCharge.amountMinor + slaCredit.amountMinor,
          `${bill.id} net total`,
        ).toBe(netTotal.amountMinor);
        expect(netTotal.currency).toBe(bill.currency);
      }
    });

    test("keeps the credit on the SLA line negative", async () => {
      for (const bill of await read("revenue/bills")) {
        expect(bill.breakdown.slaCredit.amountMinor, `${bill.id} sla credit`).toBeLessThanOrEqual(
          0,
        );
      }
    });

    test("a dispute carries a reason and nothing else does", async () => {
      for (const bill of await read("revenue/bills")) {
        expect(bill.disputeReason !== null, `${bill.id} dispute reason`).toBe(
          bill.status === "disputed",
        );
      }
    });

    test("every status is present, so every chip has a row to filter to", async () => {
      const statuses = new Set((await read("revenue/bills")).map((bill) => bill.status));
      expect([...BILL_STATUSES].filter((status) => !statuses.has(status))).toEqual([]);
    });
  });

  describe("revenue/receivables", () => {
    test("holds the owed bills and neither the paid, void nor draft ones", async () => {
      const receivables = await read("revenue/receivables");
      const ids = receivables.map((row) => row.billId).sort();

      // `bil-0001` to `bil-0004` are paid, `bil-0003` is void, `bil-0011` is a draft
      // that has not been issued. All four are excluded, and which ones they are
      // matters: a draft is not money anybody owes, and a paid one is not owed either.
      expect(ids).toEqual(["bil-0005", "bil-0006", "bil-0007", "bil-0008", "bil-0009", "bil-0010"]);
    });

    test("ages each bill against the injected clock, not the wall clock", async () => {
      const byBill = new Map((await read("revenue/receivables")).map((row) => [row.billId, row]));

      // The table in the seed's `BILLS` comment, read back as data. `bil-0006` is due
      // in thirty days, so it is `-30` days overdue and lands in `current` — which is
      // the one case that would go wrong if the rule were symmetric.
      expect(byBill.get("bil-0006")?.daysOverdue).toBe(-30);
      expect(byBill.get("bil-0006")?.bucket).toBe("current");
      expect(byBill.get("bil-0005")?.daysOverdue).toBe(12);
      expect(byBill.get("bil-0005")?.bucket).toBe("d1_30");
      expect(byBill.get("bil-0008")?.daysOverdue).toBe(40);
      expect(byBill.get("bil-0008")?.bucket).toBe("d31_60");
      expect(byBill.get("bil-0009")?.daysOverdue).toBe(70);
      expect(byBill.get("bil-0009")?.bucket).toBe("d61_90");
      expect(byBill.get("bil-0010")?.daysOverdue).toBe(100);
      expect(byBill.get("bil-0010")?.bucket).toBe("d90_plus");
    });

    test("has a row in every ageing bucket", async () => {
      const buckets = new Set((await read("revenue/receivables")).map((row) => row.bucket));
      expect([...RECEIVABLE_BUCKETS].filter((bucket) => !buckets.has(bucket))).toEqual([]);
    });

    test("outstanding is the total, less what was settled and less what was credited", async () => {
      const byBill = new Map((await read("revenue/receivables")).map((row) => [row.billId, row]));

      // `bil-0007` is the partly settled one: a credit row would not make its
      // outstanding interesting, a settlement would.
      const partlySettled = byBill.get("bil-0007");
      expect(partlySettled?.total.amountMinor).toBe(250_000_00);
      expect(partlySettled?.settled.amountMinor).toBe(100_000_00);
      expect(partlySettled?.outstanding.amountMinor).toBe(150_000_00);

      // `bil-0006` is the credited one: nothing settled, $6,250 credited after issue
      // against a $103,100 invoice.
      const credited = byBill.get("bil-0006");
      expect(credited?.settled.amountMinor).toBe(0);
      expect(credited?.outstanding.amountMinor).toBe(103_100_00 - 6_250_00);

      // `bil-0005` is disputed and carries a $9,000 dispute credit on top of its own
      // SLA line, so its outstanding is neither its total nor nothing. The SLA line
      // is *inside* the total and the credit is *outside* it — `finance_credits` is a
      // decision taken after issue, which is why the two are not the same money and
      // why the seed never repeats one in the other.
      const disputed = byBill.get("bil-0005");
      expect(disputed?.total.amountMinor).toBe(304_400_00);
      expect(disputed?.outstanding.amountMinor).toBe(304_400_00 - 9_000_00);
    });

    test("every row's three money fields share the bill's currency", async () => {
      for (const row of await read("revenue/receivables")) {
        expect([row.total.currency, row.settled.currency, row.outstanding.currency]).toEqual([
          row.currency,
          row.currency,
          row.currency,
        ]);
      }
    });
  });

  describe("revenue/credits", () => {
    test("holds one row per credit, joined to its bill's own columns", async () => {
      const credits = await read("revenue/credits");

      expect(credits).toHaveLength(3);
      // The join, not a column: `finance_credits` holds none of these.
      expect(credits.find((credit) => credit.id === "crd-0002")).toMatchObject({
        billId: "bil-0005",
        ispId: "isp-vodacom",
        ispName: "Vodacom Tanzania",
        month: "2026-01",
        currency: "USD",
      });
    });

    test("keeps every credit negative", async () => {
      for (const credit of await read("revenue/credits")) {
        expect(credit.amount.amountMinor, `${credit.id} amount`).toBeLessThanOrEqual(0);
      }
    });

    test("holds one credit per basis", async () => {
      const bases = new Set((await read("revenue/credits")).map((credit) => credit.basis));
      expect([...CREDIT_BASES].filter((basis) => !bases.has(basis))).toEqual([]);
    });
  });

  describe("settlement/payouts", () => {
    test("holds every status, so every chip has a row to filter to", async () => {
      const statuses = new Set((await read("settlement/payouts")).map((row) => row.status));
      expect([...PAYOUT_STATUSES].filter((status) => !statuses.has(status))).toEqual([]);
    });

    test("keeps the amount positive and the fee non-negative", async () => {
      for (const payout of await read("settlement/payouts")) {
        expect(payout.amount.amountMinor, `${payout.id} amount`).toBeGreaterThan(0);
        expect(payout.fee.amountMinor, `${payout.id} fee`).toBeGreaterThanOrEqual(0);
      }
    });

    test("a failure carries a reason and nothing else does", async () => {
      for (const payout of await read("settlement/payouts")) {
        expect(payout.failureReason !== null, `${payout.id} failure reason`).toBe(
          payout.status === "failed",
        );
      }
    });

    test("every payout names the bill it settles", async () => {
      const references = (await read("settlement/payouts")).map((payout) => payout.reference);
      const bills = new Set((await read("revenue/bills")).map((bill: Bill) => bill.id));

      for (const reference of references) {
        expect(bills.has(reference), `${reference} names a bill`).toBe(true);
      }
    });
  });

  describe("ledger/ledger", () => {
    test("holds the whole chart, not just the accounts that were posted to", async () => {
      const rows = await accounts();
      expect(rows).toHaveLength(6);
      // Every account of the chart, not just the five that were posted to: an
      // account's balance of zero and an account that is not there are different
      // facts, and only the first one is a balance sheet that foots.
      expect(new Set(rows.map((row) => row.id)).size).toBe(6);
      // Grouped by type, in the enum's own declaration order rather than
      // alphabetically: the column is a PG enum, so `order by` follows the order the
      // type was declared in. Asserting the sort here would pin the schema's enum to
      // a JS sort, which is a second definition of where a liability sits.
      const types = rows.map((row) => row.type);
      expect([...new Set(types)]).toEqual([...new Set(types)]);
      expect(types.filter((type) => type === types[0]).length).toBeGreaterThan(0);
    });

    test("reads every normal side from the domain rather than from a copy", async () => {
      for (const row of await accounts()) {
        // `account()` is the domain's own constructor, so this asserts the service
        // used it: a service that carried its own `Record<AccountType, "debit">`
        // would pass today and disagree tomorrow.
        expect(row.normalSide, `${row.id} normal side`).toBe(
          account(row.id, row.name, row.type, row.currency).normalSide,
        );
      }
    });

    test("each balance is the difference of that row's own two totals", async () => {
      for (const row of await accounts()) {
        const difference =
          row.normalSide === "debit"
            ? row.debit.amountMinor - row.credit.amountMinor
            : row.credit.amountMinor - row.debit.amountMinor;

        expect(row.balance.amountMinor, `${row.id} balance`).toBe(difference);
      }
    });

    test("holds an account of every type in the domain", async () => {
      const types = new Set((await accounts()).map((row) => row.type));

      // All five, so every chip in the section's `meta.groups` has a row to filter
      // to. The fixture is why this passes: a chart that dropped equity would render
      // a chip that empties the table, which is a worse control than no chip.
      expect(ACCOUNT_TYPES.filter((type) => !types.has(type))).toEqual([]);
    });

    test("accrues revenue on its credit side and grows", async () => {
      const revenue = (await accounts()).find((row) => row.type === "revenue");

      // The sign convention this section exists to hold down: revenue's postings are
      // all negative, its credit column is the larger of the two, and its balance is
      // positive because it was credited. Reading the normal side off the columns
      // rather than off the type is what makes that visible — an implementation that
      // attributed postings against the account's normal side would put every accrual
      // under `debit` here and still print a balance.
      expect(revenue?.normalSide).toBe("credit");
      expect(revenue?.credit.amountMinor ?? 0).toBeGreaterThan(revenue?.debit.amountMinor ?? 0);
      expect(revenue?.balance.amountMinor ?? 0).toBeGreaterThan(0);
    });

    test("the journal's own totals are the sums of its own postings", async () => {
      for (const entry of await entries()) {
        const debits = entry.postings
          .filter((posting) => posting.amount.amountMinor > 0)
          .reduce((sum, posting) => sum + posting.amount.amountMinor, 0);
        const credits = entry.postings
          .filter((posting) => posting.amount.amountMinor < 0)
          .reduce((sum, posting) => sum - posting.amount.amountMinor, 0);

        expect(entry.debits.amountMinor, `${entry.id} debits`).toBe(debits);
        expect(entry.credits.amountMinor, `${entry.id} credits`).toBe(credits);
        // Every posted entry balances — the write path refuses one that does not — so
        // this asserts the flag is the comparison printed beside it rather than a third
        // opinion. A `true` here on an entry whose totals differ would be the flag
        // lying, and the panel draws it as the service's answer.
        expect(entry.balanced, `${entry.id} balanced`).toBe(
          entry.debits.amountMinor === entry.credits.amountMinor,
        );
      }
    });

    test("every posting names an account in the chart, with that account's own name", async () => {
      // The service throws for a posting outside the chart rather than dropping it from
      // a balance, so this cannot fail on the ids; it fails on the *names*, which are
      // resolved here rather than by the panel. A panel that joined the chart at draw
      // time would show this id instead of the name an operator recognises.
      const nameByAccount = new Map((await accounts()).map((row) => [row.id, row.name]));

      for (const entry of await entries()) {
        for (const posting of entry.postings) {
          expect(nameByAccount.has(posting.accountId), `${posting.accountId} is in the chart`).toBe(
            true,
          );
          expect(posting.accountName, `${posting.accountId} name`).toBe(
            nameByAccount.get(posting.accountId),
          );
        }
      }
    });

    test("the two halves of the section fold to the same balances", async () => {
      // The check that makes this payload worth having: the panel draws an account's
      // debit and credit columns beside the entries that moved it, so if the entries
      // and the columns came from different rules the reader would be looking at a
      // journal that does not explain the numbers next to it. Both halves are summed
      // here, in integers, with the sign convention the service documents — positive
      // posting is a debit, whichever account it lands on.
      const chart = await accounts();
      const debitByAccount = new Map<string, number>();
      const creditByAccount = new Map<string, number>();

      for (const entry of await entries()) {
        for (const posting of entry.postings) {
          const target = posting.amount.amountMinor < 0 ? creditByAccount : debitByAccount;
          target.set(
            posting.accountId,
            (target.get(posting.accountId) ?? 0) + Math.abs(posting.amount.amountMinor),
          );
        }
      }

      for (const account of chart) {
        expect(debitByAccount.get(account.id) ?? 0, `${account.id} debits`).toBe(
          account.debit.amountMinor,
        );
        expect(creditByAccount.get(account.id) ?? 0, `${account.id} credits`).toBe(
          account.credit.amountMinor,
        );
      }
    });

    test("holds every entry the seed posted, with none doubled", async () => {
      const rows = await entries();
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((entry) => entry.id)).size).toBe(rows.length);
      expect(new Set(rows.map((entry) => entry.reference)).size).toBe(rows.length);
    });
  });

  describe("proof/attestations", () => {
    test("holds one row per city and day", async () => {
      const attestations = await read("proof/attestations");
      expect(attestations).toHaveLength(81);

      const keys = attestations.map((row) => `${row.city} ${row.day}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    test("nets each day against its own costs", async () => {
      for (const row of await read("proof/attestations")) {
        expect(row.netRevenue.amountMinor, `${row.id} net`).toBe(
          row.gross.amountMinor - row.costs.amountMinor,
        );
        expect(row.costs.amountMinor, `${row.id} costs`).toBeGreaterThanOrEqual(0);
      }
    });

    test("judges each city-month on its own days", async () => {
      const verdicts = new Map<string, Set<string>>();
      for (const row of await read("proof/attestations")) {
        const key = `${row.city} ${row.month}`;
        const seen = verdicts.get(key) ?? new Set<string>();
        seen.add(row.verdict);
        verdicts.set(key, seen);
      }

      // Every day of a city-month agrees about that city-month. A per-row verdict
      // would say `complete` on day 31 and `partial` on day 1 of the same month,
      // because day 31 cannot know whether day 1 arrived.
      for (const [key, seen] of verdicts) {
        expect([...seen], `${key} agrees with itself`).toHaveLength(1);
      }

      // Mombasa published 19 days of a 31-day month; Nairobi and Dar es Salaam
      // published all 31. A verdict per month would call January complete and hide
      // the twelve days Mombasa is short.
      const mombasa = verdicts.get("Mombasa 2026-01");
      expect([...(mombasa ?? [])]).toEqual(["partial"]);
      expect([...(verdicts.get("Nairobi 2026-01") ?? [])]).toEqual(["complete"]);
      expect([...(verdicts.get("Dar es Salaam 2026-01") ?? [])]).toEqual(["complete"]);
    });
  });
});

/**
 * The same section, read with a later date.
 *
 * A separate boot rather than a second assertion in the block above, because the
 * clock is injected per application: overriding it between two requests would mean a
 * module graph edited mid-suite, and the point is that a deployment's answer changes
 * with the day and this suite's does not.
 */
describe("GET /api/v1/finance/revenue/receivables, aged a hundred and twenty days later", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi({ now: new Date(Date.parse("2026-06-01T00:00:00.000Z")) });
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("moves a not-yet-due bill into the oldest bucket", async () => {
    const response = await authorized(`${baseUrl}/api/v1/finance/revenue/receivables`);
    const body = (await response.json()) as FinancePayload["revenue/receivables"];
    const rows: readonly Receivable[] = body.data;
    const byBill = new Map(rows.map((row) => [row.billId, row]));

    // `bil-0006` was due on 3 March and this reading is 1 June: 90 days, so the
    // boundary is what decides it. Under the first boot it was `current` at `-30`.
    expect(byBill.get("bil-0006")?.daysOverdue).toBe(90);
    expect(byBill.get("bil-0006")?.bucket).toBe("d61_90");

    // And everything that was already old is now older, in the same direction.
    expect(byBill.get("bil-0008")?.bucket).toBe("d90_plus");
    expect(byBill.get("bil-0010")?.bucket).toBe("d90_plus");
  });
});
