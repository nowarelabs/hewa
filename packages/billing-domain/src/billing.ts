import { ValidationError } from "@hewa/errors";
import {
  addMoney,
  creditablePoints,
  CURRENCY_DECIMALS,
  money,
  scaleMoney,
  subtractMoney,
  zero,
  type Currency,
  type Money,
  type SlaCommitment,
} from "@hewa/marketplace-types";

/**
 * A single metered interval.
 *
 * One row per ISP per sampling window. `averageMbps` is the mean across the
 * window rather than the peak: billing the peak would let a single spike decide
 * a month's bill.
 */
export interface UsageRecord {
  readonly ispId: string;
  /** RFC 3339 start of the window. */
  readonly windowStart: string;
  /** Length of the window in seconds. */
  readonly windowSeconds: number;
  readonly averageMbps: number;
  /** Availability delivered across the whole billing period, as a fraction. */
  readonly sla?: SlaCommitment;
}

/** The rate card an ISP is billed against. */
export interface PricingPlan {
  /** Flat charge per committed Mbps per month. */
  readonly committedRate: Money;
  /** Charge per Mbps per hour above the commitment. */
  readonly overageRatePerMbpsHour: Money;
  /** Hours in the billing month, used to price overage. */
  readonly hoursInPeriod: number;
}

/**
 * A bill, itemised.
 *
 * The components are kept rather than collapsed into a total, because a
 * disputed bill is argued line by line and a single number cannot be defended.
 */
export interface MonthlyBill {
  readonly ispId: string;
  /** Billing month as `YYYY-MM`. */
  readonly month: string;
  readonly currency: Currency;
  readonly committedMbps: number;
  /** Charge for the commitment, always billed whether used or not. */
  readonly commitmentCharge: Money;
  /** Charge for usage above the commitment, never negative. */
  readonly overageCharge: Money;
  /** Credit for an SLA shortfall. A negative amount, or zero. */
  readonly slaCredit: Money;
  /** Commitment + overage + credit. */
  readonly netTotal: Money;
}

/** The three components, so callers can price a partial period. */
export interface BillBreakdown {
  readonly commitmentCharge: Money;
  readonly overageCharge: Money;
  readonly slaCredit: Money;
  readonly netTotal: Money;
}

/**
 * Charge for the committed floor.
 *
 * Billed on the commitment rather than on usage, which is the whole point of a
 * commitment: the operator reserved the capacity, so the ISP pays whether or
 * not it flows.
 */
export function calculateCommitmentCharge(committedMbps: number, plan: PricingPlan): Money {
  assertNonNegative(committedMbps, "committedMbps");
  assertSameCurrency(plan.committedRate, plan.overageRatePerMbpsHour);
  if (plan.committedRate.currency !== "USD") {
    throw new ValidationError("The rate card is denominated in USD", {
      received: plan.committedRate.currency,
    });
  }
  // `pricePerMbps` is money per Mbps per month, so the multiplier is the Mbps
  // count itself. Minor units stay integers through the whole product.
  return scaleMoney(plan.committedRate, committedMbps);
}

/**
 * Charge for average usage above the commitment.
 *
 * Priced on the mean above the commitment, not the peak and not the integral
 * of the whole window: a burst inside one window is covered by the committed
 * capacity, and only sustained use is billable.
 */
export function calculateOverageCharge(
  averageMbps: number,
  committedMbps: number,
  plan: PricingPlan,
): Money {
  assertNonNegative(averageMbps, "averageMbps");
  assertNonNegative(committedMbps, "committedMbps");
  if (plan.hoursInPeriod <= 0) {
    throw new ValidationError("A billing period must span at least one hour", {
      received: plan.hoursInPeriod,
    });
  }
  const excessMbps = averageMbps - committedMbps;
  if (excessMbps <= 0) return zero(plan.overageRatePerMbpsHour.currency);
  return scaleMoney(plan.overageRatePerMbpsHour, excessMbps * plan.hoursInPeriod);
}

/**
 * Credit for an SLA shortfall, as a negative amount.
 *
 * Charged on whole percentage points missed, which is why a sub-point
 * shortfall credits nothing. `rate` is a fraction of the monthly charge per
 * point, so `0.1` means a tenth of the charge per point.
 */
export function calculateSlaCredit(monthlyCharge: Money, sla: SlaCommitment): Money {
  const points = creditablePoints(sla);
  if (points === 0) return zero(monthlyCharge.currency);
  // scaleMoney already rounds symmetrically, and the negation puts the credit
  // on the negative side without touching the rate's sign convention.
  return {
    amountMinor: -scaleMoney(monthlyCharge, points * sla.creditRatePerPoint).amountMinor,
    currency: monthlyCharge.currency,
  };
}

/**
 * Price a month's usage.
 *
 * The three components are independent by design: the SLA credit is assessed
 * against the *pre-credit* monthly charge, so a large credit cannot reduce its
 * own basis and cascade into a second, smaller credit.
 */
export function calculateBill(
  usage: {
    readonly ispId: string;
    readonly month: string;
    readonly committedMbps: number;
    readonly averageMbps: number;
    readonly sla?: SlaCommitment;
  },
  plan: PricingPlan,
): MonthlyBill {
  const commitmentCharge = calculateCommitmentCharge(usage.committedMbps, plan);
  const overageCharge = calculateOverageCharge(usage.averageMbps, usage.committedMbps, plan);
  const breakdown = buildBreakdown(commitmentCharge, overageCharge, usage.sla);
  return {
    ispId: usage.ispId,
    month: usage.month,
    currency: plan.committedRate.currency,
    committedMbps: usage.committedMbps,
    ...breakdown,
  };
}

/**
 * Combine the components of a bill.
 *
 * Exposed so a mid-period proration can reuse the same arithmetic, and so the
 * credit basis is provably the commitment plus overage.
 */
export function buildBreakdown(
  commitmentCharge: Money,
  overageCharge: Money,
  sla: SlaCommitment | undefined,
): BillBreakdown {
  assertSameCurrency(commitmentCharge, overageCharge);
  const chargeBasis = addMoney(commitmentCharge, overageCharge);
  const slaCredit = sla ? calculateSlaCredit(chargeBasis, sla) : zero(commitmentCharge.currency);
  return {
    commitmentCharge,
    overageCharge,
    slaCredit,
    netTotal: addMoney(chargeBasis, slaCredit),
  };
}

/**
 * Average the metered windows into the single figure a bill is priced on.
 *
 * Weighted by window length, because a 5-minute window and a 1-hour window
 * carry different amounts of evidence and an unweighted mean would let short
 * windows dominate.
 */
export function aggregateAverageMbps(records: readonly UsageRecord[]): number {
  let weightedMbpsSeconds = 0;
  let totalSeconds = 0;
  for (const record of records) {
    if (record.windowSeconds <= 0) {
      throw new ValidationError("A usage window must have a positive duration", {
        ispId: record.ispId,
        windowStart: record.windowStart,
        received: record.windowSeconds,
      });
    }
    assertNonNegative(record.averageMbps, "averageMbps");
    weightedMbpsSeconds += record.averageMbps * record.windowSeconds;
    totalSeconds += record.windowSeconds;
  }
  if (totalSeconds === 0) return 0;
  return weightedMbpsSeconds / totalSeconds;
}

/** Total metered hours across the windows, used to sanity-check a period. */
export function totalMeteredHours(records: readonly UsageRecord[]): number {
  return records.reduce((total, record) => total + record.windowSeconds, 0) / 3600;
}

/** The plan shape each tier is quoted from. */
export interface PricingTier {
  readonly id: string;
  readonly name: string;
  readonly plan: PricingPlan;
}

/**
 * Build a rate card from a per-Mbps monthly price, the idiom ISPs are quoted in.
 *
 * Keeps "quote me $30/Mbps/month" and the minor-unit arithmetic in one place, so
 * a price entered as a decimal is converted once, on the way in.
 */
export function planFromMonthlyUnitPrice(
  pricePerMbps: Money,
  overageRatePerMbpsHour: Money,
  hoursInPeriod: number,
): PricingPlan {
  return {
    committedRate: pricePerMbps,
    overageRatePerMbpsHour,
    hoursInPeriod,
  };
}

/** Convert a decimal price into minor units. Rejects anything non-exact. */
export function priceFromDecimal(decimal: string, currency: Currency): Money {
  const trimmed = decimal.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new ValidationError("Price must be a non-negative decimal string", {
      received: decimal,
    });
  }
  const decimals = CURRENCY_DECIMALS[currency];
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    // Rejecting rather than rounding: a rate card quietly rounded to the
    // nearest cent is a rate card nobody can reconcile against the quote.
    throw new ValidationError("Price is more precise than the currency allows", {
      received: decimal,
      currency,
      supported: decimals,
    });
  }
  // The whole part has to be scaled too. Padding to `decimals + 1` would leave
  // "30" USD at 30 minor units, which is 30 cents rather than 30 dollars.
  const combined = `${whole}${fraction}`.padEnd(whole.length + decimals, "0");
  const value = Number(combined);
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError("Price is too large to represent exactly", { received: decimal });
  }
  return money(value, currency);
}

/** Net the month's charges into a single receivable. */
export function totalReceivable(bills: readonly MonthlyBill[]): Money {
  if (bills.length === 0) throw new ValidationError("Cannot total an empty set of bills", {});
  const currency = bills[0]?.currency;
  if (currency === undefined) throw new ValidationError("Cannot total an empty set of bills", {});
  let total = zero(currency);
  for (const bill of bills) {
    if (bill.currency !== currency) {
      throw new ValidationError("Cannot total bills in different currencies", {
        received: bill.currency,
        expected: currency,
      });
    }
    total = addMoney(total, bill.netTotal);
  }
  return total;
}

/** Subtract what an ISP has already paid from what it owes. */
export function outstandingBalance(bill: MonthlyBill, paid: Money): Money {
  return subtractMoney(bill.netTotal, paid);
}

/**
 * @param value
 * @param field
 */
function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} cannot be negative`, { received: String(value) });
  }
}

/**
 * @param left
 * @param right
 */
function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new ValidationError("Rate card components must share a currency", {
      left: left.currency,
      right: right.currency,
    });
  }
}
