import { ResponseCode } from "@hewa/response-codes";
import {
  BILL_STATUSES,
  type Bill,
  type BillStatus,
  type CreditBasis,
  type CreditRecord,
  type FinanceGroups,
  type FinancePayload,
  type LedgerAccount,
  type LedgerEntryRecord,
  type PayoutRecord,
  type PayoutStatus,
  type Receivable,
  type ReceivableBucket,
} from "@hewa/financial-dashboard-types";
import { ACCOUNT_TYPES } from "@hewa/ledger-accounting";
import { PAYOUT_STATUSES } from "@hewa/settlement-domain";

/**
 * Finance payloads for the app's tests, written here and not borrowed.
 *
 * Deliberately not the service's rows, for the reason the console's are not: a test that
 * imports the records it is asserting about is asserting that they equal themselves.
 * These are small enough to read in one sitting, which is what lets a test say "two rows,
 * one of each of these two states" and mean something.
 *
 * ## Every `meta.groups` is the whole vocabulary, not the rows' own values
 *
 * Including groups nothing here holds — a `draft` bill, a `void` payout, a `contra`
 * account. The chips come from `meta.groups` rather than from the rows precisely so that
 * a group no current row holds still has a chip, and a fixture that derived its groups
 * from its rows would make "the chip is there" untestable: every group would have a row,
 * and no test could tell a control that survives filtering from one that blinks out with
 * the data.
 *
 * ## Two currencies in one section, on purpose
 *
 * The bills are one USD and one KES so `moneyTotals` has two groups to draw. A fixture in
 * a single currency would let a total that silently sums across currencies pass every
 * test here, and that total is the one figure in this app that must never add unlike
 * units together.
 */

/** The bills: one issued in USD, one disputed in KES. */
export const financeFixtures = {
  "revenue/bills": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "bil-fixture-1",
        ispId: "isp-karura",
        ispName: "Karura Fiber",
        month: "2026-08",
        currency: "USD",
        committedMbps: 1000,
        breakdown: {
          commitmentCharge: { amountMinor: 750_000, currency: "USD" },
          overageCharge: { amountMinor: 45_000, currency: "USD" },
          slaCredit: { amountMinor: -12_500, currency: "USD" },
          netTotal: { amountMinor: 782_500, currency: "USD" },
        },
        status: "issued",
        dueAt: "2026-09-30T00:00:00Z",
        disputeReason: null,
        issuedAt: "2026-09-01T06:00:00Z",
      },
      {
        id: "bil-fixture-2",
        ispId: "isp-mombasa",
        ispName: "Mombasa IXP",
        month: "2026-08",
        currency: "KES",
        committedMbps: 500,
        breakdown: {
          commitmentCharge: { amountMinor: 4_800_000, currency: "KES" },
          overageCharge: { amountMinor: 320_000, currency: "KES" },
          slaCredit: { amountMinor: 0, currency: "KES" },
          netTotal: { amountMinor: 5_120_000, currency: "KES" },
        },
        status: "disputed",
        // A dispute without a stated reason is refused by the database, so a fixture
        // row in this state that left it null would be a row the service could not have
        // produced — and a test asserting on it would be testing an impossible thing.
        disputeReason: "Overage measured against a different commit",
        issuedAt: "2026-09-01T06:05:00Z",
      },
    ] as Bill[],
    meta: { groups: BILL_STATUSES as readonly BillStatus[] },
  } as FinancePayload["revenue/bills"],

  "revenue/receivables": {
    code: ResponseCode.Ok,
    data: [
      {
        billId: "bil-fixture-1",
        ispId: "isp-karura",
        ispName: "Karura Fiber",
        month: "2026-08",
        currency: "USD",
        total: { amountMinor: 782_500, currency: "USD" },
        settled: { amountMinor: 0, currency: "USD" },
        outstanding: { amountMinor: 782_500, currency: "USD" },
        dueAt: "2026-09-30T00:00:00Z",
        // Negative before the due date, so this row is in the `current` bucket on a
        // positive `daysOverdue` and the panel would be lying about one of them.
        daysOverdue: -4,
        bucket: "current",
      },
      {
        billId: "bil-fixture-2",
        ispId: "isp-mombasa",
        ispName: "Mombasa IXP",
        month: "2026-07",
        currency: "KES",
        total: { amountMinor: 5_120_000, currency: "KES" },
        settled: { amountMinor: 1_120_000, currency: "KES" },
        outstanding: { amountMinor: 4_000_000, currency: "KES" },
        dueAt: "2026-08-31T00:00:00Z",
        daysOverdue: 96,
        bucket: "d90_plus",
      },
    ] as Receivable[],
    meta: {
      groups: ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as readonly ReceivableBucket[],
    },
  } as FinancePayload["revenue/receivables"],

  "revenue/credits": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "crd-fixture-1",
        billId: "bil-fixture-1",
        ispId: "isp-karura",
        ispName: "Karura Fiber",
        month: "2026-08",
        currency: "USD",
        // Negative because a credit is a reduction. A positive figure here would be
        // raised by every reader that forgot to negate it.
        amount: { amountMinor: -12_500, currency: "USD" },
        basis: "sla_shortfall",
        note: "99.60% availability against a 99.90% target",
        recordedAt: "2026-09-01T06:10:00Z",
      },
      {
        id: "crd-fixture-2",
        billId: "bil-fixture-2",
        ispId: "isp-mombasa",
        ispName: "Mombasa IXP",
        month: "2026-07",
        currency: "KES",
        amount: { amountMinor: -250_000, currency: "KES" },
        basis: "goodwill",
        note: "Two hours of outage during the corridor cut",
        recordedAt: "2026-08-02T09:00:00Z",
      },
    ] as CreditRecord[],
    meta: { groups: ["sla_shortfall", "dispute", "goodwill"] as readonly CreditBasis[] },
  } as FinancePayload["revenue/credits"],

  "settlement/payouts": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "pay-fixture-1",
        ispId: "isp-karura",
        ispName: "Karura Fiber",
        currency: "USD",
        // Positive, because "we owe Karura $4,200" is a positive fact. The settlement
        // row it came from is negative for having left; the two are different facts.
        amount: { amountMinor: 782_500, currency: "USD" },
        fee: { amountMinor: 7_825, currency: "USD" },
        status: "completed",
        method: "bank",
        reference: "bil-fixture-1",
        occurredAt: "2026-09-02T11:00:00Z",
        failureReason: null,
      },
      {
        id: "pay-fixture-2",
        ispId: "isp-mombasa",
        ispName: "Mombasa IXP",
        currency: "KES",
        amount: { amountMinor: 5_120_000, currency: "KES" },
        fee: { amountMinor: 51_200, currency: "KES" },
        // A failure with no reason is refused by the write path, for the same reason a
        // dispute with no reason is: an unexplained failure is not a fact an operator
        // can act on, so this fixture carries one.
        status: "failed",
        method: "stablecoin",
        reference: "bil-fixture-2",
        occurredAt: "2026-09-03T08:30:00Z",
        failureReason: "Beneficiary account closed",
      },
    ] as PayoutRecord[],
    meta: { groups: PAYOUT_STATUSES as readonly PayoutStatus[] },
  } as FinancePayload["settlement/payouts"],

  "ledger/ledger": {
    code: ResponseCode.Ok,
    // The one section whose data is not a list: the chart, and the journal posted
    // against it. Both halves are here, and they agree — `acc-fixture-1`'s columns are
    // the sum of its postings — because the panel draws them side by side and a fixture
    // where they disagreed would be a fixture asserting that disagreement is fine.
    data: {
      accounts: [
        {
          id: "acc-fixture-1",
          name: "Cash at bank",
          type: "asset",
          currency: "USD",
          normalSide: "debit",
          debit: { amountMinor: 4_337_500, currency: "USD" },
          credit: { amountMinor: 782_500, currency: "USD" },
          balance: { amountMinor: 3_555_000, currency: "USD" },
        },
        {
          id: "acc-fixture-2",
          name: "Revenue earned",
          type: "revenue",
          currency: "USD",
          normalSide: "credit",
          debit: { amountMinor: 0, currency: "USD" },
          credit: { amountMinor: 4_337_500, currency: "USD" },
          balance: { amountMinor: 4_337_500, currency: "USD" },
        },
        {
          id: "acc-fixture-4",
          name: "Suspense",
          type: "equity",
          currency: "USD",
          normalSide: "credit",
          // An account in the chart that nothing has been posted to. Its three figures
          // are all zero, which is a *fact* about the account rather than its absence
          // from the section — the difference the central API's own test insists on, and
          // the only way the dashboard's "nothing has moved this account" column can be
          // rendered by a test at all.
          debit: { amountMinor: 0, currency: "USD" },
          credit: { amountMinor: 0, currency: "USD" },
          balance: { amountMinor: 0, currency: "USD" },
        },
        {
          id: "acc-fixture-3",
          name: "Owed to ISPs",
          type: "liability",
          currency: "USD",
          normalSide: "credit",
          // Debited, and so a negative balance on a credit-normal account. A liability
          // that has been paid down is not a negative liability in the everyday sense,
          // it is a credit-normal account carrying a debit, and this row is the fixture
          // that keeps the panel from having to invent a sign convention for it.
          debit: { amountMinor: 782_500, currency: "USD" },
          credit: { amountMinor: 0, currency: "USD" },
          balance: { amountMinor: -782_500, currency: "USD" },
        },
      ] as readonly LedgerAccount[],
      entries: [
        {
          id: "jrn-fixture-1",
          reference: "acc-fixture-1/2026-09-01",
          description: "August revenue recognised",
          occurredAt: "2026-09-01T06:00:00Z",
          currency: "USD",
          debits: { amountMinor: 4_337_500, currency: "USD" },
          credits: { amountMinor: 4_337_500, currency: "USD" },
          balanced: true,
          postings: [
            {
              accountId: "acc-fixture-1",
              accountName: "Cash at bank",
              amount: { amountMinor: 4_337_500, currency: "USD" },
            },
            {
              accountId: "acc-fixture-2",
              accountName: "Revenue earned",
              amount: { amountMinor: -4_337_500, currency: "USD" },
            },
          ],
        },
        {
          id: "jrn-fixture-2",
          reference: "pay-fixture-1/2026-09-02",
          description: "Karura Fiber paid out",
          occurredAt: "2026-09-02T11:00:00Z",
          currency: "USD",
          debits: { amountMinor: 782_500, currency: "USD" },
          credits: { amountMinor: 782_500, currency: "USD" },
          balanced: true,
          postings: [
            {
              accountId: "acc-fixture-3",
              accountName: "Owed to ISPs",
              amount: { amountMinor: 782_500, currency: "USD" },
            },
            {
              accountId: "acc-fixture-1",
              accountName: "Cash at bank",
              amount: { amountMinor: -782_500, currency: "USD" },
            },
          ],
        },
      ] as readonly LedgerEntryRecord[],
    },
    meta: { groups: ACCOUNT_TYPES },
  } as FinancePayload["ledger/ledger"],

  "proof/attestations": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "att-fixture-1",
        city: "Nairobi",
        month: "2026-01",
        day: 31,
        currency: "USD",
        gross: { amountMinor: 8_400_000, currency: "USD" },
        costs: { amountMinor: 2_100_000, currency: "USD" },
        netRevenue: { amountMinor: 6_300_000, currency: "USD" },
        publishedAt: "2026-02-01T02:14:00Z",
        verdict: "complete",
      },
      {
        id: "att-fixture-2",
        city: "Mombasa",
        month: "2026-01",
        day: 19,
        currency: "USD",
        gross: { amountMinor: 5_100_000, currency: "USD" },
        costs: { amountMinor: 1_900_000, currency: "USD" },
        netRevenue: { amountMinor: 3_200_000, currency: "USD" },
        publishedAt: "2026-01-20T02:11:00Z",
        // A verdict about the whole city-month, carried on each of its days: this row
        // says the month is short, and it is the *missing* days that are short, so a
        // reader filtering on `complete` here is asking which cities published all of it.
        verdict: "partial",
      },
    ],
    meta: { groups: ["complete", "partial"] as FinanceGroups<"proof/attestations"> },
  } as FinancePayload["proof/attestations"],
};
