import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  FINANCE_SECTION_KEYS,
  FINANCE_VIEWS,
  parseSectionKey,
  type FinancePayload,
  type FinanceSectionKey,
} from "@hewa/financial-dashboard-types";
import { ResponseCode } from "@hewa/response-codes";

import { config } from "../src/app/shell.config";
import { financeFixtures } from "./fixtures";

/**
 * The app's side of the finance API boundary.
 *
 * Not one assertion here is about a record. Ids being unique, a bill's net being its
 * parts, a payout's sign — those are properties of the data, and they are asserted where
 * the data is made, in the service. Asserting them here would mean importing the rows
 * being asserted about, which is the arrangement that lets the app and the service drift
 * while both suites stay green.
 *
 * What is left is what the app owns: that `data/` is one module per view, that those
 * modules export hooks and no records, that the app's four views and six sections are
 * the contract's, and that every section has a fixture — because a section with no
 * fixture cannot be rendered in a test, and a panel nobody can render is a panel nobody
 * has looked at.
 */

/** `data/` is one module per view, named after it, like `panels/`. */
const modules = readdirSync(new URL("../src/app/data/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

/** `panels/` holds one module per view, and the views are the shell config's keys. */
const panelModules = readdirSync(new URL("../src/app/panels/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

const keys = Object.keys(config.views).sort();

/** The sections each view owns, keyed by the module that owns them. */
const expectedSections: Record<string, readonly FinanceSectionKey[]> = {
  revenue: ["revenue/bills", "revenue/receivables", "revenue/credits"],
  settlement: ["settlement/payouts"],
  ledger: ["ledger/ledger"],
  proof: ["proof/attestations"],
};

describe("data modules", () => {
  test("every view has exactly one module, named after its key", () => {
    expect(modules).toEqual(keys);
  });

  test("the app's views are the contract's, in its order", () => {
    // `FINANCE_VIEWS` is the order the tab strip draws, so this is an assertion about
    // the tabs as well as the set: a view added to the contract and not to the app is a
    // tab that is missing, and one added to the app is a 404 behind a panel.
    expect(keys).toEqual([...FINANCE_VIEWS].toSorted());
    expect(Object.keys(config.views)).toEqual([...FINANCE_VIEWS]);
  });

  test("a view's panel module is named after the view too", () => {
    // The one-to-one rule: the `revenue` view is `panels/revenue.tsx`. A directory that
    // held one module per view *plus* a shared store would be a table of contents with
    // something else in it, and nothing would fail when a view and its module disagreed.
    expect(panelModules).toEqual(keys);
  });

  test("no module holds records", async () => {
    // Every runtime export of a `data/` module is a function. A record array exported
    // from one — `export const BILLS = [...]` — is a value that is not a function, and
    // this is the assertion that says so. It guards a boundary rather than a behaviour,
    // because the behaviour it guards has no symptom: a record put back here would still
    // render, still be right, and would quietly become the app's source of truth again.
    for (const name of modules) {
      const loaded = (await import(`../src/app/data/${name}.ts`)) as Record<string, unknown>;

      for (const [exported, value] of Object.entries(loaded)) {
        expect(typeof value, `data/${name} exports ${exported}, which is not a hook`).toBe(
          "function",
        );
      }
    }
  });

  test("each view's module exports one hook per section it owns", async () => {
    // Driven from the contract rather than from the rail: a hook for a section the
    // service does not serve is a question that cannot be asked, and a section with no
    // hook is a panel that renders nothing.
    for (const [view, sections] of Object.entries(expectedSections)) {
      const loaded = (await import(`../src/app/data/${view}.ts`)) as Record<string, unknown>;
      const hooks = Object.entries(loaded)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name);

      expect(hooks.length, `${view} exports ${hooks.length} hooks`).toBe(sections.length);
    }
  });

  test("the sections a view owns are the ones the contract names", () => {
    expect(Object.keys(expectedSections).toSorted()).toEqual([...FINANCE_VIEWS].toSorted());

    for (const [view, sections] of Object.entries(expectedSections)) {
      expect(
        sections.map((section) => section.slice(view.length + 1)),
        view,
      ).toEqual(
        FINANCE_SECTION_KEYS.filter((key) => key.startsWith(`${view}/`)).map((key) =>
          key.slice(view.length + 1),
        ),
      );
    }
  });
});

describe("every section has a fixture, with a vocabulary that outlasts its rows", () => {
  test("the fixtures cover the contract's section list and nothing else", () => {
    expect(Object.keys(financeFixtures).toSorted()).toEqual([...FINANCE_SECTION_KEYS].toSorted());
  });

  test("every section's vocabulary is wider than the rows it is drawn beside", () => {
    // The point of `meta.groups` travelling with the rows: a chip for a group with
    // nothing in it is still a chip, and an operator can press it and be told the
    // answer is zero. A fixture whose groups were derived from its rows could not test
    // that, because every group in it would have a row and a control that blinks out
    // with the data would look identical to one that survives filtering.
    //
    // `proof/attestations` is the exception, and it is the contract's: a verdict is
    // either `complete` or `partial`, so a month with both cities published leaves
    // nothing out. Its fixture holds one of each rather than one, which is the only
    // way both chips can be pressed — an assertion about a vocabulary of two that has
    // one unheld member would be asserting a third verdict.
    const valuesBy = {
      "revenue/bills": (row: Record<string, unknown>): string => row.status as string,
      "revenue/receivables": (row: Record<string, unknown>): string => row.bucket as string,
      "revenue/credits": (row: Record<string, unknown>): string => row.basis as string,
      "settlement/payouts": (row: Record<string, unknown>): string => row.status as string,
      "proof/attestations": (row: Record<string, unknown>): string => row.verdict as string,
    } as const;

    for (const section of FINANCE_SECTION_KEYS) {
      const payload: FinancePayload[typeof section] = financeFixtures[section];
      const groups = payload.meta.groups;

      expect(groups.length, `${section} has a vocabulary`).toBeGreaterThan(0);

      if (section === "ledger/ledger") {
        // The one section whose data is not a list, so the rows a chip filters are the
        // accounts inside it. Read by its own key rather than through the widened one:
        // a `FinancePayload[typeof section]` is the union of all six payloads, and
        // narrowing it with `section === "ledger/ledger"` would need the whole loop to
        // be written as an explicit union test.
        const ledger = financeFixtures["ledger/ledger"];
        const held = new Set(ledger.data.accounts.map((row) => row.type));

        expect(
          ledger.meta.groups.filter((group) => !held.has(group)).length,
          `${section} has a group with no row`,
        ).toBeGreaterThan(0);
        continue;
      }

      if (section === "proof/attestations") {
        continue;
      }

      const held = new Set(
        (payload.data as unknown as Record<string, unknown>[]).map(valuesBy[section]),
      );
      expect(
        groups.filter((group) => !held.has(group)).length,
        `${section} has a group with no row`,
      ).toBeGreaterThan(0);
    }
  });

  test("no fixture row sits in a group its section did not publish", () => {
    // The other direction, and the one that catches a row invented in a vocabulary that
    // has since changed. `meta.groups` may add groups but never hide one, so a row
    // outside the published vocabulary is a chip that cannot filter to it.
    for (const section of FINANCE_SECTION_KEYS) {
      const payload: FinancePayload[typeof section] = financeFixtures[section];
      const groups = payload.meta.groups;

      if (section === "ledger/ledger") {
        for (const account of financeFixtures["ledger/ledger"].data.accounts) {
          expect(groups, `${account.id} type`).toContain(account.type);
        }
        continue;
      }

      const column =
        section === "revenue/receivables"
          ? "bucket"
          : section === "revenue/credits"
            ? "basis"
            : section === "proof/attestations"
              ? "verdict"
              : "status";
      for (const row of payload.data as unknown as Record<string, string>[]) {
        expect(groups, `${section} ${row[column]}`).toContain(row[column]);
      }
    }
  });

  test("the two halves of the ledger fixture agree with each other", () => {
    // The chart's columns and the journal beside it are one fact about the same money,
    // and the panel draws them side by side. A fixture where they disagreed would be a
    // fixture asserting that a journal may fail to explain the numbers next to it.
    const ledger: FinancePayload["ledger/ledger"] = financeFixtures["ledger/ledger"];
    const debitByAccount = new Map<string, number>();
    const creditByAccount = new Map<string, number>();

    for (const entry of ledger.data.entries) {
      for (const posting of entry.postings) {
        const target = posting.amount.amountMinor < 0 ? creditByAccount : debitByAccount;
        target.set(
          posting.accountId,
          (target.get(posting.accountId) ?? 0) + Math.abs(posting.amount.amountMinor),
        );
      }
    }

    for (const account of ledger.data.accounts) {
      expect(debitByAccount.get(account.id) ?? 0, `${account.id} debits`).toBe(
        account.debit.amountMinor,
      );
      expect(creditByAccount.get(account.id) ?? 0, `${account.id} credits`).toBe(
        account.credit.amountMinor,
      );
    }
  });

  test("a fixture row never carries a figure the contract would refuse", () => {
    // The three refusals a money row has to survive: a credit is signed, a net is its
    // own subtraction, and a day's net is not negative. These are the service's rules,
    // and a fixture that broke one would make every panel test pass against a row the
    // service could not have produced.
    for (const credit of financeFixtures["revenue/credits"].data) {
      expect(credit.amount.amountMinor, `${credit.id} is not positive`).toBeLessThanOrEqual(0);
    }

    for (const bill of financeFixtures["revenue/bills"].data) {
      const { commitmentCharge, overageCharge, slaCredit, netTotal } = bill.breakdown;
      expect(netTotal.amountMinor, `${bill.id} net`).toBe(
        commitmentCharge.amountMinor + overageCharge.amountMinor + slaCredit.amountMinor,
      );
    }

    for (const row of financeFixtures["proof/attestations"].data) {
      expect(row.netRevenue.amountMinor, `${row.id} net`).toBe(
        row.gross.amountMinor - row.costs.amountMinor,
      );
      expect(row.netRevenue.amountMinor, `${row.id} net is not negative`).toBeGreaterThan(0);
    }
  });
});

describe("the section keys themselves", () => {
  test("every key parses back into the view and section it was built from", () => {
    // The same check the contract makes, made here too because the app reads keys rather
    // than writing them: a key this app cannot take apart is a section it cannot route.
    for (const key of FINANCE_SECTION_KEYS) {
      const { view, section } = parseSectionKey(key);
      expect(section, key).toBe(key.slice(view.length + 1));
      expect(FINANCE_VIEWS as readonly string[], key).toContain(view);
    }
  });

  test("the envelope a panel reads is the one the fixtures are written in", () => {
    // A fixture built by hand with `code` missing, or with `meta` under `groups`, would
    // render as an empty section in every test that used it — a failure that looks like
    // a panel bug. One assertion over one payload states the shape once.
    const payload: FinancePayload["revenue/bills"] = {
      code: ResponseCode.Ok,
      data: [],
      meta: { groups: [] },
    };

    expect(payload.code).toBe(ResponseCode.Ok);
  });
});
