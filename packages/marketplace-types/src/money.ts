import { ValidationError } from "@hewa/errors";

/**
 * Currencies the marketplace settles in.
 *
 * `USD` is the unit of account, `USDC` is how payouts reach an ISP wallet, and
 * `KES` is the local currency an ISP prices its own retail customers in.
 */
export const CURRENCIES = ["USD", "USDC", "KES"] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * Smallest divisible unit of each currency, as a power of ten.
 *
 * USDC is the reason this table exists. It has six decimals while USD and KES
 * have two, so anything that assumes two will be wrong by ten thousand times.
 */
export const CURRENCY_DECIMALS: Readonly<Record<Currency, number>> = {
  USD: 2,
  USDC: 6,
  KES: 2,
};

const CURRENCY_SET: ReadonlySet<string> = new Set(CURRENCIES);

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCY_SET.has(value);
}

export function assertCurrency(value: unknown): asserts value is Currency {
  if (!isCurrency(value)) {
    throw new ValidationError("Unsupported currency", {
      received: String(value),
      supported: [...CURRENCIES],
    });
  }
}

/**
 * An amount of money held as an integer in the currency's smallest unit.
 *
 * Money is never a float in this package. `0.1 + 0.2 !== 0.3` is a rounding
 * curiosity in a spreadsheet and a reconciliation nightmare in a ledger, and
 * every one of these packages ends up writing to double-entry books. Integers
 * make that arithmetic exact; minor units keep fractional cents representable.
 */
export interface Money {
  /** Amount in the currency's smallest unit, e.g. cents. May be negative. */
  readonly amountMinor: number;
  readonly currency: Currency;
}

export function money(amountMinor: number, currency: Currency): Money {
  assertCurrency(currency);
  if (!Number.isSafeInteger(amountMinor)) {
    throw new ValidationError("Money must be a safe integer in minor units", {
      received: String(amountMinor),
      currency,
    });
  }
  return { amountMinor, currency };
}

/** Zero in the given currency, so a fresh ledger line is never `undefined`. */
export function zero(currency: Currency): Money {
  return { amountMinor: 0, currency };
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Money>;
  return (
    typeof candidate.amountMinor === "number" &&
    Number.isSafeInteger(candidate.amountMinor) &&
    isCurrency(candidate.currency)
  );
}

/** Throws unless both sides are in the same currency. */
function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new ValidationError("Cannot combine amounts in different currencies", {
      left: left.currency,
      right: right.currency,
    });
  }
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor + right.amountMinor, currency: left.currency };
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor - right.amountMinor, currency: left.currency };
}

export function negateMoney(value: Money): Money {
  return { amountMinor: -value.amountMinor, currency: value.currency };
}

export function sumMoney(values: readonly Money[], currency: Currency): Money {
  let total = zero(currency);
  for (const value of values) total = addMoney(total, value);
  return total;
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0;
}

export function isNegative(value: Money): boolean {
  return value.amountMinor < 0;
}

/**
 * Round half away from zero, symmetrically.
 *
 * `Math.round` rounds half *up*, so it sends `-1.5` to `-1`. SLA credits and
 * overage refunds are negative amounts, and that asymmetry would quietly bias
 * every negative line towards zero — in the operator's favour, and only
 * visible when someone sums a year of credits.
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Multiply an amount by a plain ratio without leaving integer land.
 *
 * `amountMinor * rate` keeps the integer intact, so rounding only happens when
 * the product is not a whole number of minor units — which is the same place
 * every other billing system rounds too.
 */
export function scaleMoney(value: Money, rate: number): Money {
  if (!Number.isFinite(rate)) {
    throw new ValidationError("Rate must be a finite number", { received: String(rate) });
  }
  return {
    amountMinor: roundHalfAwayFromZero(value.amountMinor * rate),
    currency: value.currency,
  };
}

/**
 * Render an amount for humans and for logs.
 *
 * Never used for arithmetic, and deliberately never parsed back: a formatted
 * string is not a `Money`.
 */
export function formatMoney(value: Money): string {
  const decimals = CURRENCY_DECIMALS[value.currency];
  const sign = value.amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(value.amountMinor);
  const divisor = 10 ** decimals;
  const whole = Math.floor(absolute / divisor);
  const fraction = String(absolute % divisor).padStart(decimals, "0");
  return `${sign}${whole}.${fraction} ${value.currency}`;
}
