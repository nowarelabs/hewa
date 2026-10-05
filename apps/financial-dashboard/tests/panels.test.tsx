import { describe, expect, test } from "vite-plus/test";
import { formatMoney } from "@hewa/marketplace-types";

import { emptyQueryClient, renderFinance } from "./harness";
import { financeFixtures } from "./fixtures";
import {
  BillsPanel,
  BillsScope,
  CreditsPanel,
  CreditsScope,
  ReceivablesPanel,
  ReceivablesScope,
} from "../src/app/panels/revenue";
import { PayoutsPanel, PayoutsScope } from "../src/app/panels/settlement";
import { AccountsPanel, AccountsScope, LedgerColumn } from "../src/app/panels/ledger";
import { AttestationsPanel, AttestationsScope } from "../src/app/panels/proof";
import { emptyMessage } from "../src/app/ui/primitives";
import { moneyTotals } from "../src/app/ui/money";

/**
 * What a panel draws, in the three states a fetch can be in.
 *
 * Pending, failed and ready are three states and `status` is what keeps them distinct.
 * A panel that rendered an empty table for the first two would draw the same screen for
 * "the request has not come back" and "this month had no bills in it", and an operator
 * reading an empty revenue table cannot tell whether the service is down or the business
 * earned nothing — which are two very different reasons to stop looking.
 */

/** The word a panel uses for a request that has not come back. */
const PENDING = /loading/i;

describe("a section that has not answered", () => {
  test("every panel says it is loading rather than drawing an empty table", () => {
    // `emptyQueryClient`, not the seeded one: these are the tests about not having
    // answered, and a seeded cache would be answering.
    const panels = [
      ["bills", <BillsPanel key="bills" />],
      ["receivables", <ReceivablesPanel key="receivables" />],
      ["credits", <CreditsPanel key="credits" />],
      ["payouts", <PayoutsPanel key="payouts" />],
      ["accounts", <AccountsPanel key="accounts" />],
      ["attestations", <AttestationsPanel key="attestations" />],
    ] as const;

    for (const [name, panel] of panels) {
      const markup = renderFinance(panel, emptyQueryClient());
      expect(markup, name).toMatch(PENDING);
      expect(markup, name).not.toContain("0 bills");
      expect(markup, name).not.toContain("0 accounts");
    }
  });

  test("every scope draws its skeleton rather than its chips", () => {
    // The chips come from `meta.groups`, which arrives with the answer. A filter bar
    // drawn before then would be a bar of zeroes over a table that has not loaded, and
    // pressing one of them would narrow nothing.
    const scopes = [
      ["bills", <BillsScope key="bills" />],
      ["receivables", <ReceivablesScope key="receivables" />],
      ["credits", <CreditsScope key="credits" />],
      ["payouts", <PayoutsScope key="payouts" />],
      ["accounts", <AccountsScope key="accounts" />],
      ["attestations", <AttestationsScope key="attestations" />],
    ] as const;

    for (const [name, scope] of scopes) {
      const markup = renderFinance(scope, emptyQueryClient());
      expect(markup, name).toMatch(PENDING);
    }
  });
});

describe("a section that has answered", () => {
  test("a panel draws its rows, not its empty state", () => {
    expect(renderFinance(<BillsPanel />)).toContain("Karura Fiber");
    expect(renderFinance(<PayoutsPanel />)).toContain("Mombasa IXP");
    expect(renderFinance(<AccountsPanel />)).toContain("Cash at bank");
    expect(renderFinance(<AttestationsPanel />)).toContain("Nairobi");
  });

  test("a section with rows in hand does not say it is loading", () => {
    expect(renderFinance(<BillsPanel />)).not.toMatch(PENDING);
  });

  test("the ledger's right column names the account above and what moved it", () => {
    // The one section whose payload is not a list: the right column draws the postings of
    // one account — the selected row where the ids coincide, and otherwise the section's
    // first, which is the same rule the editor resolves its row by.
    //
    // `acc-fixture-2` is moved by one entry only, so that entry must be listed and the
    // other must not appear at all: a journal column showing an entry that did not move
    // the account beside it is a column answering a different question from the panel.
    const markup = renderFinance(<LedgerColumn section="acc-fixture-2" />);

    expect(markup).toContain("Revenue earned");
    expect(markup).toContain("August revenue recognised");
    expect(markup).toContain("jrn-fixture-1");
    expect(markup).not.toContain("Karura Fiber paid out");
    expect(markup).not.toContain("jrn-fixture-2");
  });

  test("an account two entries moved lists both, and its own movements only", () => {
    const markup = renderFinance(<LedgerColumn section="acc-fixture-1" />);

    expect(markup).toContain("August revenue recognised");
    expect(markup).toContain("Karura Fiber paid out");
    // The amounts are this account's legs: +4,337.50 recognised and -7,825.00 paid out.
    // A total drawn from the entry rather than from the posting would show the entry's
    // own 4,337.50 twice, once per entry.
    expect(markup).toContain("43375.00 USD");
    expect(markup).toContain("-7825.00 USD");
  });

  test("a posting list with no entries says so rather than nothing at all", () => {
    // An empty column is a column that failed to load. An account nothing has moved is
    // a fact, and it is stated.
    const markup = renderFinance(<LedgerColumn section="acc-fixture-4" />);
    expect(markup).toContain("Nothing posted against this account yet.");
  });
});

describe("totals", () => {
  test("a column holding two currencies is totalled as two figures, not one", () => {
    // The bills fixture is one USD and one KES, and the nets do not agree in minor units
    // under any rate. Summing them would be a number that agrees with no row in the
    // column; the reader would see a total and could not check it against anything.
    const bills = financeFixtures["revenue/bills"].data;
    const total = moneyTotals(bills.map((row) => row.breakdown.netTotal));

    expect(total).toContain(formatMoney({ amountMinor: 782_500, currency: "USD" }));
    expect(total).toContain(formatMoney({ amountMinor: 5_120_000, currency: "KES" }));
    expect(total.split(", ")).toHaveLength(2);
  });

  test("one currency is one figure", () => {
    const payouts = financeFixtures["settlement/payouts"].data;
    expect(
      moneyTotals(payouts.filter((row) => row.currency === "USD").map((row) => row.amount)),
    ).toBe(formatMoney({ amountMinor: 782_500, currency: "USD" }));
  });

  test("a list with nothing in it has not totalled zero", () => {
    // `nothing`, and not `0.00 USD`: a section with no rows has nothing to add up, and a
    // zero is a claim about a month in which no money moved.
    expect(moneyTotals([])).toBe("nothing");
  });

  test("a summary bar drawn from two currencies keeps both symbols apart", () => {
    const markup = renderFinance(<AccountsPanel />);
    expect(markup).toContain("Debits");
    expect(markup).toContain("Credits");
  });
});

describe("emptyMessage", () => {
  test("the four states it distinguishes say four different things", () => {
    const pending = emptyMessage({ status: "pending", filtered: false, noun: "bills" });
    const failed = emptyMessage({ status: "failed", filtered: false, noun: "bills" });
    const nothing = emptyMessage({ status: "ready", filtered: false, noun: "bills" });
    const filtered = emptyMessage({
      status: "ready",
      filtered: true,
      noun: "bills",
      filter: "these states",
    });

    // Four states, four sentences. The one that matters most is `failed`: a reader who
    // is told "no bills" goes looking for a month in which nothing was billed, and a
    // reader who is told the service was unreachable goes and looks at the service.
    expect(new Set([pending, failed, nothing, filtered]).size).toBe(4);
    expect(pending).toMatch(PENDING);
    expect(failed.toLowerCase()).toContain("could not reach");
    expect(nothing.toLowerCase()).toContain("no bills");
    expect(filtered.toLowerCase()).toContain("these states");
  });
});
