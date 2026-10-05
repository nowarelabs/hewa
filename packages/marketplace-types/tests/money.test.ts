import { describe, expect, test } from "vite-plus/test";
import {
  addMoney,
  CURRENCY_DECIMALS,
  formatMoney,
  isCurrency,
  money,
  scaleMoney,
  subtractMoney,
  sumMoney,
  sumMoneyByCurrency,
  zero,
} from "../src/money.ts";

describe("money", () => {
  test("refuses a fractional minor amount", () => {
    // 0.1 + 0.2 !== 0.3 is a curiosity in a spreadsheet and a reconciliation
    // bug in a ledger, so floats never get past the constructor.
    expect(() => money(10.5, "USD")).toThrow(/safe integer/);
  });

  test("refuses an unsupported currency", () => {
    expect(() => money(100, "EUR" as never)).toThrow(/Unsupported currency/);
  });

  test("knows each currency's exponent", () => {
    // The reason this table exists: assuming two decimals for a stablecoin is
    // wrong by ten thousand times.
    expect(CURRENCY_DECIMALS.USDC).toBe(6);
    expect(CURRENCY_DECIMALS.USD).toBe(2);
    expect(CURRENCY_DECIMALS.KES).toBe(2);
  });
});

describe("arithmetic", () => {
  test("adds and subtracts within a currency", () => {
    expect(addMoney(money(1250, "USD"), money(500, "USD")).amountMinor).toBe(1750);
    expect(subtractMoney(money(1250, "USD"), money(500, "USD")).amountMinor).toBe(750);
  });

  test("refuses to mix currencies", () => {
    // Silently adding USD to USDC would be a rounding error nobody could find.
    expect(() => addMoney(money(100, "USD"), money(100, "KES"))).toThrow(/different currencies/);
  });

  test("stays exact where floats would not", () => {
    const a = money(10, "USD");
    const b = money(20, "USD");
    expect(addMoney(a, b).amountMinor).toBe(30);
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  test("sums a possibly empty list", () => {
    expect(sumMoney([], "KES")).toEqual(zero("KES"));
    expect(sumMoney([money(1, "KES"), money(2, "KES")], "KES").amountMinor).toBe(3);
  });

  test("sums a mixed list into one amount per currency", () => {
    // The reason this exists: `sumMoney` is given a currency and refuses a mismatch, so
    // a caller holding a mixed list has to group before it can total anything. Three
    // totals is the honest answer; one would be a conversion nobody named.
    expect(
      sumMoneyByCurrency([
        money(100, "USD"),
        money(1, "KES"),
        money(50, "USD"),
        money(2_000_000, "USDC"),
      ]),
      // In `CURRENCIES` order — USD, USDC, KES — rather than alphabetical.
    ).toEqual([money(150, "USD"), money(2_000_000, "USDC"), money(1, "KES")]);
  });

  test("orders the totals by the currency list, not by arrival", () => {
    // Two renders of the same list, one of them filtered, have to agree: a summary bar
    // whose figures reorder themselves between the first paint and the second is a
    // summary bar nobody can read twice.
    expect(sumMoneyByCurrency([money(1, "USDC"), money(1, "USD")])).toEqual(
      sumMoneyByCurrency([money(1, "USD"), money(1, "USDC")]),
    );
  });

  test("is empty for an empty list, rather than zero in every currency", () => {
    expect(sumMoneyByCurrency([])).toEqual([]);
  });

  test("keeps a sum exact across USDC's six decimals", () => {
    // 0.1 + 0.2 in USDC minor units is three units, and in a float it is not.
    const total = sumMoneyByCurrency([money(1, "USDC"), money(2, "USDC")]);
    expect(total[0]?.amountMinor).toBe(3);
    expect(formatMoney(total[0]!)).toBe("0.000003 USDC");
  });
});

describe("scaleMoney", () => {
  test("keeps an exact product", () => {
    expect(scaleMoney(money(1000, "USD"), 0.5).amountMinor).toBe(500);
  });

  test("rounds a fractional minor unit away from zero", () => {
    // Rounding to even would bias a long series of prorated charges low.
    expect(scaleMoney(money(3, "USD"), 0.5).amountMinor).toBe(2);
    expect(scaleMoney(money(-3, "USD"), 0.5).amountMinor).toBe(-2);
  });

  test("refuses a non-finite rate", () => {
    expect(() => scaleMoney(money(100, "USD"), Number.NaN)).toThrow(/finite/);
    expect(() => scaleMoney(money(100, "USD"), Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe("formatMoney", () => {
  test("renders each currency at its own exponent", () => {
    expect(formatMoney(money(123456, "USD"))).toBe("1234.56 USD");
    expect(formatMoney(money(1234567, "USDC"))).toBe("1.234567 USDC");
    expect(formatMoney(money(5, "KES"))).toBe("0.05 KES");
  });

  test("keeps the sign outside the digits", () => {
    expect(formatMoney(money(-123456, "USD"))).toBe("-1234.56 USD");
  });
});

describe("isCurrency", () => {
  test("accepts supported currencies only", () => {
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("KES")).toBe(true);
    expect(isCurrency("usd")).toBe(false);
    expect(isCurrency(undefined)).toBe(false);
  });
});
