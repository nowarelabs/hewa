import { ValidationError } from "@hewa/errors";
import {
  assertHex32,
  assertSignature,
  isChainId,
  MAX_TOKEN_AMOUNT,
  type ChainId,
  type Hex32,
  type Signature,
  type TokenAmount,
} from "./chain.ts";

/** A calendar day, as `YYYYMMDD`. */
export type DayKey = number;

const DAY_KEY_PATTERN = /^\d{8}$/;

/**
 * Validate a `YYYYMMDD` day key.
 *
 * A day is the unit a bond is settled in, so a malformed one is a settlement
 * against the wrong day rather than a parse error somewhere downstream. The
 * month and day ranges are checked too, because `20261345` is a valid integer
 * and an impossible date.
 */
export function assertDayKey(value: unknown): DayKey {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !DAY_KEY_PATTERN.test(String(value))
  ) {
    throw new ValidationError("A day key must be a YYYYMMDD integer", { received: String(value) });
  }
  const year = Math.floor(value / 10_000);
  const month = Math.floor((value % 10_000) / 100);
  const day = value % 100;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new ValidationError("A day key must be a real calendar date", {
      received: String(value),
    });
  }
  return value;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The `YYYYMMDD` key for a UTC instant. */
export function dayKeyOf(instant: Date): DayKey {
  return assertDayKey(
    Number(
      `${String(instant.getUTCFullYear()).padStart(4, "0")}${String(
        instant.getUTCMonth() + 1,
      ).padStart(2, "0")}${String(instant.getUTCDate()).padStart(2, "0")}`,
    ),
  );
}

/**
 * The revenue for one city on one day, as published on chain.
 *
 * The `uint256` fields on the contract are these fields, and nothing else: a
 * value that cannot be represented as a `bigint` inside `uint256` must not get
 * this far.
 */
export interface DailyRevenueRecord {
  readonly city: string;
  readonly day: DayKey;
  /** Total for the day, in USDC base units. */
  readonly revenue: TokenAmount;
  /** How many ISP payments the day aggregates. */
  readonly ispCount: number;
}

/** The root a day's payments commit to, and who signed it. */
export interface Attestation {
  readonly record: DailyRevenueRecord;
  /** Merkle root over the day's individual ISP payments. */
  readonly merkleRoot: Hex32;
  /**
   * Signature over the digest, by the platform's attestation key.
   *
   * This proves the figure came from us. It does not prove the figure is true —
   * see `@hewa/revenue-proof-protocol` for what a signature does and does not
   * establish.
   */
  readonly signature: Signature;
}

/** A bond as the contract holds it. */
export interface BondState {
  readonly bondId: string;
  readonly city: string;
  /** Chain the bond is deployed on. */
  readonly chainId: ChainId;
  /** Contract address. */
  readonly address: `0x${string}`;
  /** USDC face value outstanding, in base units. */
  readonly supply: TokenAmount;
  /** Annual rate as an exact fraction: 800/10_000 is 8%. */
  readonly rateNumerator: number;
  readonly rateDenominator: number;
  /** Payout frequency in days, so the rate is applied per period exactly. */
  readonly periodDays: number;
}

/** One payout the contract has made, or would make. */
export interface PayoutRecord {
  readonly bondId: string;
  readonly holder: `0x${string}`;
  /** USDC base units. */
  readonly amount: TokenAmount;
  /** Period end, as a `YYYYMMDD` day key. */
  readonly period: DayKey;
  readonly transactionHash: Hex32;
}

/** A month's proof of reserves, as pinned off chain and referenced on chain. */
export interface ReservesReport {
  readonly city: string;
  /** Reporting month as `YYYYMM`. */
  readonly month: number;
  readonly grossRevenue: TokenAmount;
  readonly operatingCosts: TokenAmount;
  readonly netRevenue: TokenAmount;
  /** What the contract recorded for the same period, for comparison. */
  readonly onChainRevenue: TokenAmount;
  readonly merkleRoot: Hex32;
  /** Content address of the full report. */
  readonly documentHash: Hex32;
}

/** Net revenue, floored at zero. */
export function netRevenueOf(gross: TokenAmount, costs: TokenAmount): TokenAmount {
  const net = gross - costs;
  return net > 0n ? net : 0n;
}

/**
 * A bondholder's payout for one period, in USDC base units.
 *
 * `supply * rate * periodDays / (denominator * 365)` is the linear
 * day-weighted accrual, floored. A rate expressed as an exact fraction and a
 * period expressed in days means the same holder earns the same total
 * regardless of how many periods the bond is split into — which a flat
 * `rate / 12` does not, and which matters when a bond's period is ever changed.
 */
export function bondholderAccrual(
  supply: TokenAmount,
  rateNumerator: number,
  rateDenominator: number,
  periodDays: number,
  balance: TokenAmount,
): TokenAmount {
  if (!Number.isInteger(rateNumerator) || rateNumerator < 0) {
    throw new ValidationError("A bond rate numerator must be a non-negative integer", {
      received: String(rateNumerator),
    });
  }
  if (!Number.isInteger(rateDenominator) || rateDenominator <= 0) {
    throw new ValidationError("A bond rate denominator must be a positive integer", {
      received: String(rateDenominator),
    });
  }
  if (!Number.isInteger(periodDays) || periodDays <= 0) {
    throw new ValidationError("A payout period must be at least one day", {
      received: String(periodDays),
    });
  }
  if (balance < 0n || balance > supply) {
    throw new ValidationError("A holder balance must lie within the bond supply", {
      balance: balance.toString(),
      supply: supply.toString(),
    });
  }
  if (supply === 0n) return 0n;
  // Every factor is multiplied and there is exactly one division, at the end.
  // Rounding the *aggregate* interest first and then pro-rating it is off by up
  // to one base unit per holder and collapses to zero for a small bond: a
  // 1,000-base-unit bond at 8%/yr over 30 days earns 0 units of total interest
  // when floored, so every holder would be paid nothing despite the bond having
  // paid out. One division at the end is also the only expression a contract can
  // reproduce, since Solidity truncates at each `/` it writes.
  const numerator = supply * BigInt(rateNumerator) * BigInt(periodDays) * balance;
  const denominator = BigInt(rateDenominator) * 365n * supply;
  return numerator / denominator;
}

/** Validate an amount before it is offered to a contract. */
export function assertTokenAmount(value: unknown, field: string): TokenAmount {
  if (typeof value !== "bigint") {
    // A `number` here is the bug this catches: 1e18 is not a safe integer, so a
    // figure that arrived as a float has already lost precision.
    throw new ValidationError(`${field} must be a bigint in token base units`, {
      received: typeof value === "number" ? String(value) : typeof value,
    });
  }
  if (value < 0n) {
    throw new ValidationError(`${field} cannot be negative`, { received: value.toString() });
  }
  if (value > MAX_TOKEN_AMOUNT) {
    throw new ValidationError(`${field} exceeds the largest amount a contract will accept`, {
      received: value.toString(),
    });
  }
  return value;
}

/** Validate the pair a contract needs to identify a day's attestation. */
export function assertRecordKey(city: string, day: unknown): DayKey {
  if (city.trim() === "") {
    throw new ValidationError("An attestation needs a city", {});
  }
  return assertDayKey(day);
}

export { assertHex32, assertSignature, isChainId };
