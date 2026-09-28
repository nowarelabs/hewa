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
