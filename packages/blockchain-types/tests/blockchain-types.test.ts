import { describe, expect, test } from "vite-plus/test";
import {
  assertAddress,
  assertChainId,
  assertHex32,
  assertDayKey,
  assertTokenAmount,
  bondholderAccrual,
  chainName,
  dayKeyOf,
  formatTokenAmount,
  isAddress,
  isChainId,
  isHex32,
  isSignature,
  MAX_TOKEN_AMOUNT,
  netRevenueOf,
  normalizeAddress,
  normalizeSignature,
  usdc,
  USD_DECIMALS,
  USDC_DECIMALS,
  type TokenAmount,
} from "../src/index.ts";

describe("chain ids", () => {
  test("knows the chains we settle on", () => {
    expect(isChainId(137)).toBe(true);
    expect(chainName(137)).toBe("Polygon");
    expect(isChainId(999_999)).toBe(false);
  });

  test("rejects a chain id it does not know", () => {
    // A typo'd chain id would post an attestation to an address on a network
    // nobody reads, which looks identical to a successful post.
    expect(() => assertChainId(999_999)).toThrow(/Unknown chain id/);
    expect(() => assertChainId("137")).toThrow(/Unknown chain id/);
  });
});

describe("token amounts", () => {
  test("builds USDC in 6 decimals", () => {
    expect(USDC_DECIMALS).toBe(6);
    expect(usdc(1)).toBe(1_000_000n);
    expect(usdc(200_000)).toBe(200_000_000_000n);
    expect(usdc(12, 345_678)).toBe(12_345_678n);
  });

  test("holds an amount a JavaScript number could not", () => {
    // 1e18 exceeds Number.MAX_SAFE_INTEGER, so a figure carried as a number has
    // already lost its low digits before the contract ever sees it.
    const wei = 10n ** 18n;
    expect(wei).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(formatTokenAmount(wei, 18)).toBe("1.000000000000000000");
  });

  test("formats with the token's own precision", () => {
    expect(formatTokenAmount(usdc(2_000), USDC_DECIMALS)).toBe("2000.000000");
    expect(formatTokenAmount(usdc(1, 500_000), USDC_DECIMALS)).toBe("1.500000");
    expect(formatTokenAmount(250n, USD_DECIMALS)).toBe("2.50");
    expect(formatTokenAmount(-usdc(1), USDC_DECIMALS)).toBe("-1.000000");
    expect(formatTokenAmount(7n, 0)).toBe("7");
  });

  test("rejects a fractional whole part", () => {
    expect(() => usdc(1.5)).toThrow(/whole part/);
    expect(() => usdc(-1)).toThrow(/whole part/);
    expect(() => usdc(1, 1.5)).toThrow(/fractional part/);
  });

  test("refuses a float where a contract needs an integer", () => {
    // This is the guard that catches the 1e18 mistake at the boundary rather
    // than letting a rounded figure reach a payout.
    expect(() => assertTokenAmount(6700 * 1e18, "revenue")).toThrow(/bigint/);
    expect(() => assertTokenAmount(1, "revenue")).toThrow(/bigint/);
    expect(assertTokenAmount(0n, "revenue")).toBe(0n);
  });

  test("refuses a negative or absurd amount", () => {
    expect(() => assertTokenAmount(-1n, "revenue")).toThrow(/cannot be negative/);
    expect(() => assertTokenAmount(MAX_TOKEN_AMOUNT + 1n, "revenue")).toThrow(/largest amount/);
  });
});

describe("addresses", () => {
  const lower = "0x1234567890abcdef1234567890abcdef12345678";

  test("accepts lowercase and rejects anything else", () => {
    expect(isAddress(lower)).toBe(true);
    expect(isAddress(lower.toUpperCase().replace("0X", "0x"))).toBe(false);
    expect(isAddress(`${lower}00`)).toBe(false);
  });

  test("normalises a checksummed address", () => {
    // Solidity compares addresses case-sensitively as strings, so a
    // checksummed address pasted by a bondholder and a lowercase one from the
    // keeper must not be able to disagree about being the same account.
    const checksummed = "0x1234567890AbcdEF1234567890aBcdef12345678";
    expect(normalizeAddress(checksummed)).toBe(lower);
  });

  test("rejects a malformed address", () => {
    expect(() => normalizeAddress("0x1234")).toThrow(/valid EVM address/);
    expect(() => normalizeAddress("not an address")).toThrow(/valid EVM address/);
    expect(() => assertAddress(lower.toUpperCase(), "holder")).toThrow(/lowercase hex/);
  });
});

describe("32-byte values", () => {
  const hash = `0x${"ab".repeat(32)}`;
  test("accepts a lowercase 32-byte hex value", () => {
    expect(isHex32(hash)).toBe(true);
    expect(assertHex32(hash, "root")).toBe(hash);
  });

  test("rejects a short, long, or uppercase hash", () => {
    expect(isHex32(`0x${"ab".repeat(31)}`)).toBe(false);
    expect(isHex32(`0x${"ab".repeat(33)}`)).toBe(false);
    expect(isHex32(`0x${"AB".repeat(32)}`)).toBe(false);
  });
});

describe("day keys", () => {
  test("derives a YYYYMMDD key from a UTC instant", () => {
    expect(dayKeyOf(new Date("2026-09-28T23:59:59.000Z"))).toBe(20260928);
    expect(dayKeyOf(new Date("2026-01-01T00:00:00.000Z"))).toBe(20260101);
  });

  test("refuses an impossible calendar date", () => {
    // A valid integer that is not a date is a settlement against the wrong day.
    // Note the assertion is on the key, not on `new Date`: JavaScript rolls
    // 2026-02-30 over to 2026-02-28 without complaint, so a date-only test
    // would pass against a guard that does not exist.
    expect(() => assertDayKey(20260230)).toThrow(/real calendar date/);
    expect(() => assertDayKey(20261301)).toThrow(/real calendar date/);
    expect(() => assertDayKey(20260000)).toThrow(/real calendar date/);
    expect(assertDayKey(20280229)).toBe(20280229);
  });

  test("derives a leap day correctly", () => {
    expect(dayKeyOf(new Date("2028-02-29T00:00:00.000Z"))).toBe(20280229);
  });
});

describe("net revenue", () => {
  test("subtracts costs", () => {
    expect(netRevenueOf(usdc(200_000), usdc(120_000))).toBe(usdc(80_000));
  });

  test("floors at zero rather than going negative", () => {
    // A month where costs exceed revenue is a loss. Reporting it as negative
    // net revenue would make a payout formula underflow on chain.
    expect(netRevenueOf(usdc(100), usdc(200))).toBe(0n);
  });
});

describe("bondholder accrual", () => {
  const supply = usdc(2_000_000);
  // 8% a year, paid monthly, on a $2,000,000 bond held whole.
  const rate: [number, number] = [800, 10_000];
  const monthly = 30;

  test("accrues a day-weighted share of the annual interest", () => {
    // $2,000,000 at 8% a year is $160,000; 30 of 365 days of that is
    // $13,150.68. Dividing by twelve instead would pay $13,333.33, which is
    // $1,182 a bond too much a year on every full holder.
    expect(bondholderAccrual(supply, ...rate, monthly, supply)).toBe(13_150_684_931n);
  });

  test("splits the period interest by holding", () => {
    const quarter = supply / 4n;
    const whole = bondholderAccrual(supply, ...rate, monthly, supply);
    const part = bondholderAccrual(supply, ...rate, monthly, quarter);
    // A quarter of the supply earns a quarter of the interest, short by the
    // dust that integer division floors away — three base units, three millionths
    // of a cent.
    expect(part * 4n).toBe(whole - 3n);
    expect(part * 4n).toBeLessThanOrEqual(whole);
    expect(part * 4n + 4n).toBeGreaterThan(whole);
  });

  test("pays nothing when there is no supply", () => {
    expect(bondholderAccrual(0n, ...rate, monthly, 0n)).toBe(0n);
  });

  test("accrues a whole year at exactly the stated rate", () => {
    // This is the property that makes the per-annum fraction and the day count
    // worth carrying. A flat `rate / 12` paid monthly only sums back to the
    // stated rate on a month that happens to be 30 days, and drifts from there.
    const perYear = bondholderAccrual(supply, ...rate, 365, supply);
    expect(formatTokenAmount(perYear, USDC_DECIMALS)).toBe("160000.000000");
    // 365 days of accrual equals the rate applied once to the whole supply.
    expect(perYear).toBe((supply * 800n) / 10_000n);
  });

  test("pays more for a longer period", () => {
    // A 30-day and a 31-day month are both "a month" to a human and differ by
    // a day of interest. Weighting by days is what makes that correct.
    const per30 = bondholderAccrual(supply, ...rate, 30, supply);
    const per31 = bondholderAccrual(supply, ...rate, 31, supply);
    expect(per31).toBeGreaterThan(per30);
    expect(per31 - per30).toBe(bondholderAccrual(supply, ...rate, 1, supply));
  });

  test("refuses an unpriceable rate or an impossible balance", () => {
    expect(() => bondholderAccrual(supply, -1, 10_000, monthly, supply)).toThrow(/numerator/);
    expect(() => bondholderAccrual(supply, 800, 0, monthly, supply)).toThrow(/denominator/);
    expect(() => bondholderAccrual(supply, ...rate, 0, supply)).toThrow(/at least one day/);
    expect(() => bondholderAccrual(supply, ...rate, monthly, supply + 1n)).toThrow(/within/);
    expect(() => bondholderAccrual(supply, ...rate, monthly, -1n)).toThrow(/within/);
  });

  test("floors the holder's own share, not the aggregate interest first", () => {
    // Rounding the whole bond's interest to an integer and then pro-rating the
    // rounded number shortchanges every holder whose share lands on a fraction.
    // Here the aggregate is 52.86 units, so flooring it first pays 52 where the
    // holder's true share is 52.9.
    expect(bondholderAccrual(1_000_000n, 73, 2400, 7, 90_909n)).toBe(53n);
  });

  test("pays a full holder exactly the aggregate interest", () => {
    // The supply cancels, so this is the identity a holder has a right to check:
    // hold everything, get everything the bond earned.
    const whole = bondholderAccrual(1_000_000n, 73, 7, 30, 1_000_000n);
    expect(whole).toBe((1_000_000n * 73n * 30n) / (7n * 365n));
  });

  test("never pays out more in aggregate than the bond earned", () => {
    // The balances partition the supply, so the sum of per-holder payouts is a
    // genuine split of one bond's interest and must not exceed it. This is where
    // an intermediate floor shows up: at 1 unit of supply the aggregate floors to
    // 0 first, and every holder of that bond is paid zero while the contract
    // still holds funds.
    const tiny: TokenAmount = 1_000_000n;
    const holders = [1n, 7n, 992_000n, 7_992n];
    expect(holders.reduce((a, b) => a + b, 0n)).toBe(tiny);

    const paid = holders.reduce(
      (sum, balance) => sum + bondholderAccrual(tiny, 73, 7, 30, balance),
      0n,
    );
    const whole = bondholderAccrual(tiny, 73, 7, 30, tiny);
    expect(whole).toBeGreaterThan(0n);
    expect(paid).toBeGreaterThan(0n);
    // Flooring each share can only lose dust to the bond, never mint it.
    expect(paid).toBeLessThanOrEqual(whole);
  });
});

describe("rounding", () => {
  test("floors a holder's payout in their favour or ours, never above the whole", () => {
    const supply: TokenAmount = 1_000_000_000n;
    const whole = bondholderAccrual(supply, 800, 10_000, 30, supply);
    const parts = [1n, 3n, 7n, 11n].map(
      (n) => bondholderAccrual(supply, 800, 10_000, 30, (supply * n) / 100n) as bigint,
    );
    // Flooring each share can only lose dust, never create it.
    expect(parts.reduce((a, b) => a + b, 0n)).toBeLessThanOrEqual(whole);
  });
});

describe("EIP-191 signatures", () => {
  // A real 65-byte signature, taken from a throwaway key. Only the shape is
  // under test here; producing one is `revenue-proof-protocol`'s business.
  const SIGNATURE = `0x${"11".repeat(32)}${"22".repeat(32)}1b` as const;

  test("is 65 bytes: r, s, and v", () => {
    expect(isSignature(SIGNATURE)).toBe(true);
    expect(SIGNATURE.length).toBe(132);
  });

  test("is not a 32-byte hash", () => {
    // The whole reason `Signature` is a separate type. A signature and a digest
    // are both `0x`-prefixed hex, and one predicate for both would let a 32-byte
    // hash stand in for a signature — or reject every real one.
    const digest = `0x${"33".repeat(32)}` as const;
    expect(isHex32(digest)).toBe(true);
    expect(isSignature(digest)).toBe(false);
    expect(isHex32(SIGNATURE)).toBe(false);
  });

  test("rejects a signature with a 64-byte body", () => {
    expect(isSignature(`0x${"11".repeat(64)}`)).toBe(false);
  });

  test("rejects a 32-byte body with a trailing v and no s", () => {
    expect(isSignature(`0x${"11".repeat(32)}1b`)).toBe(false);
  });

  test("rejects uppercase hex, matching every other value here", () => {
    // Comparisons happen in Solidity and in logs; a stray capital would make
    // two identical signatures compare unequal.
    expect(isSignature(SIGNATURE.toUpperCase().replace("0X", "0x"))).toBe(false);
  });

  test("normalises uppercase to lowercase", () => {
    expect(normalizeSignature(SIGNATURE.toUpperCase().replace("0X", "0x"))).toBe(SIGNATURE);
  });

  test("refuses to normalise anything that is not a signature", () => {
    expect(() => normalizeSignature("0xdeadbeef")).toThrow(/valid EIP-191 signature/);
    expect(() => normalizeSignature(`0x${"33".repeat(32)}`)).toThrow(/valid EIP-191 signature/);
  });
});
