import { describe, expect, test } from "vite-plus/test";
import { money } from "@hewa/marketplace-types";
import {
  ACCOUNT_TYPES,
  account,
  assertBalanced,
  assertLedgerBalances,
  balancesFrom,
  chargeRevenue,
  isAccountType,
  journalEntry,
  posting,
  rawBalancesFrom,
  settleReceivable,
  totalsFor,
  trialBalance,
  accrueSlaCredit,
  convertCurrencies,
  recordChainFee,
  settlePayoutObligation,
} from "../src/index.ts";

const receivable = account("ar:isp:1", "Receivable - ISP", "asset", "USD");
const revenue = account("rev:bandwidth", "Revenue - bandwidth", "revenue", "USD");
const cash = account("asset:cash", "Cash", "asset", "USD");
const payable = account("ap:isp:1", "Payable - ISP", "liability", "USD");
const usdcClearing = account("asset:usdc", "Clearing - USDC", "asset", "USDC");
const fxPosition = account("equity:fx", "FX position", "equity", "USD");
const chainExpense = account("exp:chain", "Expense - chain fees", "expense", "USDC");

describe("chart of accounts", () => {
  test("assigns the normal balance side per type", () => {
    // Assets grow on the debit side, revenue on the credit side. Getting this
    // backwards inverts every balance derived from the entry.
    expect(receivable.normalSide).toBe("debit");
    expect(revenue.normalSide).toBe("credit");
  });

  test("keeps the type set small and closed", () => {
    expect(ACCOUNT_TYPES).toHaveLength(5);
    for (const type of ACCOUNT_TYPES) expect(isAccountType(type)).toBe(true);
    expect(isAccountType("contra")).toBe(false);
  });

  test("rejects an unknown type at construction", () => {
    expect(() => account("x", "X", "contra" as never, "USD")).toThrow(/Unsupported account type/);
  });
});

describe("double-entry invariant", () => {
  test("accepts an entry that balances", () => {
    const entry = journalEntry("je_1", "ref_1", "2026-10-31T23:59:59.000Z", "Charge", [
      posting(receivable.id, money(300_000, "USD")),
      posting(revenue.id, money(-300_000, "USD")),
    ]);
    expect(entry.postings).toHaveLength(2);
  });

  test("rejects an entry that does not balance", () => {
    // The whole reason this package exists: a one-sided entry is money that
    // appeared from nowhere.
    expect(() =>
      journalEntry("je_1", "ref_1", "2026-10-31T23:59:59.000Z", "Bad", [
        posting(receivable.id, money(300_000, "USD")),
        posting(revenue.id, money(-299_999, "USD")),
      ]),
    ).toThrow(/does not balance/);
  });

  test("rejects a single-posting entry", () => {
    expect(() =>
      journalEntry("je_1", "ref_1", "t", "Bad", [posting(receivable.id, money(1, "USD"))]),
    ).toThrow(/at least two postings/);
  });

  test("checks each currency independently", () => {
    // A USD-only pair balances, and a stray KES posting does not get absorbed.
    expect(() =>
      journalEntry("je_1", "ref_1", "t", "Bad", [
        posting(receivable.id, money(100, "USD")),
        posting(revenue.id, money(-100, "USD")),
        posting("fx:kes", money(50, "KES")),
      ]),
    ).toThrow(/does not balance/);
  });
});

describe("totals", () => {
  const entry = journalEntry("je_1", "ref_1", "t", "Charge", [
    posting(receivable.id, money(300_000, "USD")),
    posting(revenue.id, money(-200_000, "USD")),
    posting("rev:burst", money(-100_000, "USD")),
  ]);

  test("splits debits from credits", () => {
    const totals = totalsFor(entry, "USD");
    expect(totals.debits.amountMinor).toBe(300_000);
    expect(totals.credits.amountMinor).toBe(300_000);
  });
});

describe("balance folding", () => {
  const chart = [receivable, revenue, cash];
  const charge = chargeRevenue(
    "je_1",
    "bill:2026-10",
    "2026-10-31T23:59:59.000Z",
    money(373_000, "USD"),
    receivable.id,
    revenue.id,
  );
  const payment = settleReceivable(
    "je_2",
    "pay:2026-10",
    "2026-11-01T00:05:00.000Z",
    money(373_000, "USD"),
    receivable.id,
    cash.id,
  );

  test("nets an account across entries", () => {
    const balances = balancesFrom(chart, [charge, payment]);
    const ar = balances.find((b) => b.accountId === receivable.id);
    expect(ar?.balance.amountMinor).toBe(0);
  });

  test("shows revenue and cash positive on their own normal side", () => {
    // A finance reader expects earned revenue as a positive number. It was
    // credited, which is why the raw sum is negative and the normal-side view
    // flips it.
    const balances = balancesFrom(chart, [charge, payment]);
    expect(balances.find((b) => b.accountId === revenue.id)?.balance.amountMinor).toBe(373_000);
    expect(balances.find((b) => b.accountId === cash.id)?.balance.amountMinor).toBe(373_000);
  });

  test("exposes the raw signed view for reconciliation", () => {
    // Credit-normal revenue is negative before the flip, which is what a
    // debit-positive export needs.
    const raw = rawBalancesFrom([charge]);
    expect(raw.find((b) => b.accountId === revenue.id)?.balance.amountMinor).toBe(-373_000);
  });

  test("omits accounts that were never touched", () => {
    // Distinguishing zero from never-seen is what makes a reconciliation report
    // honest rather than padded with zeros.
    const balances = balancesFrom(chart, [charge]);
    expect(balances.find((b) => b.accountId === "never:used")).toBeUndefined();
  });

  test("rejects a posting to an account outside the chart", () => {
    // Otherwise the balance has no known sign convention.
    expect(() =>
      balancesFrom(chart, [
        settleReceivable("x", "r", "t", money(1, "USD"), receivable.id, "ghost"),
      ]),
    ).toThrow(/outside the chart/);
  });

  test("rejects a posting in the wrong currency for the account", () => {
    const mixed = settleReceivable("x", "r", "t", money(100, "KES"), receivable.id, cash.id);
    expect(() => balancesFrom(chart, [mixed])).toThrow(/does not match the account/);
  });

  test("debits exactly as much as it credits", () => {
    const trial = trialBalance([charge, payment], "USD");
    expect(trial.debits.amountMinor).toBe(746_000);
    expect(trial.credits.amountMinor).toBe(746_000);
    expect(trial.balanced).toBe(true);
  });

  test("asserts balance rather than returning null when there is nothing", () => {
    expect(trialBalance([], "USD").debits.amountMinor).toBe(0);
    expect(trialBalance([], "USD").balanced).toBe(true);
    expect(() => assertLedgerBalances([charge], "USD")).not.toThrow();
  });
});

describe("entry templates", () => {
  test("accrues an SLA credit as a negative receivable", () => {
    // billing-domain hands over a negative amount; the receivable has to fall.
    const entry = accrueSlaCredit(
      "je_3",
      "sla:2026-10",
      "2026-10-31T23:59:59.000Z",
      money(-37_300, "USD"),
      receivable.id,
      revenue.id,
    );
    expect(totalsFor(entry, "USD").debits.amountMinor).toBe(37_300);
    expect(totalsFor(entry, "USD").credits.amountMinor).toBe(37_300);
  });

  test("every template produces a balanced entry", () => {
    const entries = [
      chargeRevenue("a", "r", "t", money(1_000, "USD"), receivable.id, revenue.id),
      settleReceivable("b", "r", "t", money(1_000, "USD"), receivable.id, cash.id),
      accrueSlaCredit("c", "r", "t", money(-100, "USD"), receivable.id, revenue.id),
    ];
    for (const entry of entries)
      expect(() => assertBalanced(entry.postings, entry.id)).not.toThrow();
  });
});

describe("stablecoin payout", () => {
  /**
   * A payout is three entries, not one. The version that was drawn first —
   * retained earnings, the ISP payout account, and gas, in a single entry —
   * does not balance and cannot be made to, and putting a USD leg and a USDC
   * leg in one entry fails for a different reason again: `assertBalanced`
   * nets each currency separately, so the two can never cancel.
   */
  const payout = () => [
    settlePayoutObligation(
      "je:pay:1",
      "payout:2026-09:vituIT",
      "2026-09-15T02:00:00.000Z",
      money(12_500_00, "USD"),
      payable.id,
      cash.id,
    ),
    convertCurrencies(
      "je:fx:1",
      "payout:2026-09:vituIT",
      "2026-09-15T02:00:00.000Z",
      money(12_500_00, "USD"),
      money(12_500_000_000, "USDC"),
      cash.id,
      usdcClearing.id,
      fxPosition.id,
    ),
    recordChainFee(
      "je:fee:1",
      "payout:2026-09:vituIT",
      "2026-09-15T02:20:00.000Z",
      money(2_000_000, "USDC"),
      chainExpense.id,
      usdcClearing.id,
    ),
  ];

  test("balances every currency independently", () => {
    const entries = payout();
    expect(() => assertLedgerBalances(entries, "USD")).not.toThrow();
    expect(() => assertLedgerBalances(entries, "USDC")).not.toThrow();
  });

  test("is rejected if USD and USDC are tried as one balanced entry", () => {
    // The trap, pinned: a naive entry that debits the USD amount and credits
    // the USDC amount reads as "balanced" to the eye and is not.
    expect(() =>
      journalEntry("je:naive", "r", "t", "naive", [
        posting(cash.id, money(12_500_00, "USD")),
        posting(usdcClearing.id, money(-12_500_000_000, "USDC")),
      ]),
    ).toThrow(/Ledger entry does not balance|balance/);
  });

  test("leaves the FX difference on the position account", () => {
    // At par, the position nets to nothing. Buy 12,500.00 USD of USDC for
    // 12,499.00 and the shortfall is the realised loss, not a rounding error
    // to be absorbed silently.
    const entry = convertCurrencies(
      "je:fx:2",
      "r",
      "t",
      money(12_499_00, "USD"),
      money(12_500_000_000, "USDC"),
      cash.id,
      usdcClearing.id,
      fxPosition.id,
    );
    const usd = totalsFor(entry, "USD");
    expect(usd.debits.amountMinor).toBe(usd.credits.amountMinor);
    expect(totalsFor(entry, "USDC").debits.amountMinor).toBe(
      totalsFor(entry, "USDC").credits.amountMinor,
    );
    expect(entry.postings.filter((p) => p.accountId === fxPosition.id)).toHaveLength(2);
  });

  test("refuses a conversion that changes no currency", () => {
    expect(() =>
      convertCurrencies(
        "je:fx:3",
        "r",
        "t",
        money(100, "USD"),
        money(100, "USD"),
        cash.id,
        cash.id,
        fxPosition.id,
      ),
    ).toThrow(/must change currency/);
  });

  test("keeps the chain fee out of the FX result", () => {
    const entries = payout();
    const fx = convertCurrencies(
      "je:fx:4",
      "r",
      "t",
      money(12_500_00, "USD"),
      money(12_500_000_000, "USDC"),
      cash.id,
      usdcClearing.id,
      fxPosition.id,
    );
    const usdcFromFee = entries
      .filter((e) => e.id === "je:fee:1")
      .flatMap((e) => e.postings)
      .filter((p) => p.accountId === usdcClearing.id)
      .reduce((sum, p) => sum + p.amount.amountMinor, 0);
    const usdcFromFx = fx.postings
      .filter((p) => p.accountId === usdcClearing.id)
      .reduce((sum, p) => sum + p.amount.amountMinor, 0);
    expect(usdcFromFee).not.toBe(0);
    expect(usdcFromFx).toBe(12_500_000_000);
  });
});
