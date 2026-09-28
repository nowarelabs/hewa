import { describe, expect, test } from "vite-plus/test";
import { money, slaCommitment } from "@hewa/marketplace-types";
import {
  aggregateAverageMbps,
  buildBreakdown,
  calculateBill,
  calculateCommitmentCharge,
  calculateOverageCharge,
  calculateSlaCredit,
  outstandingBalance,
  priceFromDecimal,
  totalMeteredHours,
  totalReceivable,
  type PricingPlan,
  type UsageRecord,
} from "../src/index.ts";

/** $30 per Mbps per month, $0.05 per Mbps per hour of overage, 730-hour month. */
const plan: PricingPlan = {
  committedRate: money(3_000, "USD"),
  overageRatePerMbpsHour: money(5, "USD"),
  hoursInPeriod: 730,
};

describe("commitment charge", () => {
  test("bills the commitment whether or not it is used", () => {
    // The operator reserved the capacity, so an ISP that sends nothing still pays.
    expect(calculateCommitmentCharge(100, plan).amountMinor).toBe(300_000);
    expect(calculateCommitmentCharge(0, plan).amountMinor).toBe(0);
  });

  test("stays exact where a float would drift", () => {
    // 100 Mbps at $0.07 is 700 cents, not 699.9999999999999.
    const odd: PricingPlan = { ...plan, committedRate: money(7, "USD") };
    expect(calculateCommitmentCharge(100, odd).amountMinor).toBe(700);
  });

  test("rejects a rate card in the wrong currency", () => {
    // Both components move together, so this reaches the USD rule rather than
    // stopping at the mismatched-currency check.
    expect(() =>
      calculateCommitmentCharge(100, {
        ...plan,
        committedRate: money(3_000, "KES"),
        overageRatePerMbpsHour: money(5, "KES"),
      }),
    ).toThrow(/denominated in USD/);
  });

  test("rejects a rate card whose components disagree", () => {
    expect(() =>
      calculateCommitmentCharge(100, { ...plan, committedRate: money(3_000, "KES") }),
    ).toThrow(/must share a currency/);
  });
});

describe("overage charge", () => {
  test("charges only on sustained use above the commitment", () => {
    // 20 Mbps over a 730-hour month at 5 cents per Mbps-hour.
    expect(calculateOverageCharge(120, 100, plan).amountMinor).toBe(73_000);
  });

  test("charges nothing at or below the commitment", () => {
    expect(calculateOverageCharge(100, 100, plan).amountMinor).toBe(0);
    expect(calculateOverageCharge(40, 100, plan).amountMinor).toBe(0);
  });

  test("rejects a period with no hours", () => {
    expect(() => calculateOverageCharge(120, 100, { ...plan, hoursInPeriod: 0 })).toThrow(
      /at least one hour/,
    );
  });
});

describe("SLA credit", () => {
  const sla = slaCommitment(0.995, 0.98, 0.1);

  test("credits whole points missed, on the pre-credit charge", () => {
    // 99.5% against 98.0% is 1.5 points, so one point bills. The basis is
    // commitment plus overage, not the total after the credit.
    const credit = calculateSlaCredit(money(373_000, "USD"), sla);
    expect(credit.amountMinor).toBe(-37_300);
  });

  test("is a negative amount, so it nets off rather than adding", () => {
    expect(calculateSlaCredit(money(100_000, "USD"), sla).amountMinor).toBeLessThan(0);
  });

  test("credits nothing when delivery met the target", () => {
    expect(
      calculateSlaCredit(money(100_000, "USD"), slaCommitment(0.995, 0.9999, 0.1)).amountMinor,
    ).toBe(0);
  });

  test("credits nothing for a sub-point shortfall", () => {
    // 99.7% against a 99.5% target is a real miss but bills at zero. The
    // residual stays visible in slaShortfallPoints for reporting.
    expect(
      calculateSlaCredit(money(100_000, "USD"), slaCommitment(0.995, 0.997, 0.1)).amountMinor,
    ).toBe(0);
  });

  test("does not shrink its own basis and cascade", () => {
    // 10 points missed at 5% of the charge per point is half the basis. If the
    // credit were assessed against the post-credit total, a second pass would
    // find a 50,000 basis and shave off another 2,500.
    const brutal = slaCommitment(1.0, 0.9, 0.05);
    const breakdown = buildBreakdown(money(100_000, "USD"), money(0, "USD"), brutal);
    expect(breakdown.slaCredit.amountMinor).toBe(-50_000);
    expect(breakdown.netTotal.amountMinor).toBe(50_000);
  });

  test("assesses the credit against commitment plus overage, once", () => {
    // The basis has to include overage, or a month with heavy use is credited
    // against the commitment alone.
    const breakdown = buildBreakdown(
      money(100_000, "USD"),
      money(40_000, "USD"),
      slaCommitment(1.0, 0.9, 0.05),
    );
    expect(breakdown.slaCredit.amountMinor).toBe(-70_000);
    expect(breakdown.netTotal.amountMinor).toBe(70_000);
  });
});

describe("monthly bill", () => {
  const bill = calculateBill(
    {
      ispId: "isp_1",
      month: "2026-10",
      committedMbps: 100,
      averageMbps: 120,
      sla: slaCommitment(0.995, 0.98, 0.1),
    },
    plan,
  );

  test("itemises the three components", () => {
    expect(bill.commitmentCharge.amountMinor).toBe(300_000);
    expect(bill.overageCharge.amountMinor).toBe(73_000);
    expect(bill.slaCredit.amountMinor).toBe(-37_300);
    expect(bill.netTotal.amountMinor).toBe(335_700);
  });

  test("keeps the components rather than only the total", () => {
    // A disputed bill is argued line by line.
    expect(bill.currency).toBe("USD");
    expect(bill.committedMbps).toBe(100);
    expect(bill.month).toBe("2026-10");
  });

  test("totals exactly in minor units", () => {
    expect(bill.netTotal.amountMinor).toBe(
      bill.commitmentCharge.amountMinor +
        bill.overageCharge.amountMinor +
        bill.slaCredit.amountMinor,
    );
  });

  test("bills a compliant ISP with no credit line", () => {
    const compliant = calculateBill(
      {
        ispId: "isp_1",
        month: "2026-10",
        committedMbps: 100,
        averageMbps: 120,
        sla: slaCommitment(0.995, 0.9999, 0.1),
      },
      plan,
    );
    expect(compliant.slaCredit.amountMinor).toBe(0);
    expect(compliant.netTotal.amountMinor).toBe(373_000);
  });

  test("works with no SLA data at all", () => {
    const noSla = calculateBill(
      { ispId: "isp_1", month: "2026-10", committedMbps: 100, averageMbps: 120 },
      plan,
    );
    expect(noSla.slaCredit.amountMinor).toBe(0);
    expect(noSla.netTotal.amountMinor).toBe(373_000);
  });
});

describe("usage aggregation", () => {
  const records: UsageRecord[] = [
    {
      ispId: "isp_1",
      windowStart: "2026-10-01T00:00:00.000Z",
      windowSeconds: 300,
      averageMbps: 100,
    },
    {
      ispId: "isp_1",
      windowStart: "2026-10-01T00:05:00.000Z",
      windowSeconds: 3_600,
      averageMbps: 200,
    },
  ];

  test("weights windows by their length", () => {
    // An unweighted mean would report 150 and let the 5-minute window count as
    // much as the hour.
    expect(aggregateAverageMbps(records)).toBeCloseTo(192.3077, 3);
  });

  test("returns zero for no records rather than dividing by zero", () => {
    expect(aggregateAverageMbps([])).toBe(0);
  });

  test("sums metered hours across windows", () => {
    expect(totalMeteredHours(records)).toBeCloseTo(1.0833, 3);
  });

  test("rejects a zero-length window", () => {
    expect(() => aggregateAverageMbps([{ ...records[0]!, windowSeconds: 0 }])).toThrow(
      /positive duration/,
    );
  });
});

describe("prices entered as decimals", () => {
  test("converts on the way in", () => {
    expect(priceFromDecimal("30", "USD").amountMinor).toBe(3_000);
    expect(priceFromDecimal("0.05", "USD").amountMinor).toBe(5);
  });

  test("keeps six decimals for a stablecoin", () => {
    expect(priceFromDecimal("1.234567", "USDC").amountMinor).toBe(1_234_567);
  });

  test("refuses anything that is not a plain decimal", () => {
    // A price typed as an expression or a float is how precision gets lost.
    expect(() => priceFromDecimal("1e3", "USD")).toThrow(/decimal string/);
    expect(() => priceFromDecimal("-1", "USD")).toThrow(/decimal string/);
    expect(() => priceFromDecimal("1.2.3", "USD")).toThrow(/decimal string/);
  });

  test("refuses more precision than the currency carries", () => {
    // A rate card quietly rounded to the nearest cent cannot be reconciled
    // against the quote it came from.
    expect(() => priceFromDecimal("0.001", "USD")).toThrow(/more precise/);
    expect(() => priceFromDecimal("0.0000001", "USDC")).toThrow(/more precise/);
  });

  test("keeps a whole-number price at the right scale", () => {
    // Padding to the fraction width alone would leave "30" USD at 30 cents.
    expect(priceFromDecimal("30.00", "USD").amountMinor).toBe(3_000);
    expect(priceFromDecimal("1", "USDC").amountMinor).toBe(1_000_000);
  });
});

describe("portfolio totals", () => {
  /** A bill whose net total is exactly `minor`, so the totals below are unambiguous. */
  const bill = (ispId: string, minor: number) =>
    calculateBill(
      { ispId, month: "2026-10", committedMbps: 1, averageMbps: 1 },
      {
        ...plan,
        committedRate: money(minor, "USD"),
      },
    );

  test("nets a set of bills", () => {
    expect(totalReceivable([bill("a", 1_000), bill("b", 2_000)]).amountMinor).toBe(3_000);
  });

  test("refuses an empty set", () => {
    expect(() => totalReceivable([])).toThrow(/empty set/);
  });

  test("nets what is still owed after a part payment", () => {
    expect(outstandingBalance(bill("a", 3_000), money(1_000, "USD")).amountMinor).toBe(2_000);
  });
});
