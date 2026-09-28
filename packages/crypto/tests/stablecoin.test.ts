import { describe, expect, test } from "vite-plus/test";
import { money } from "@hewa/marketplace-types";
import {
  applyQuote,
  contractAddress,
  conversionQuote,
  InMemoryStablecoinWallet,
  isChainId,
  isExpired,
  isValidAddress,
  normalizeAddress,
  STABLECOINS,
  type ConversionQuote,
} from "../src/index.ts";

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

const quote = (rateNumerator = 1_000_000n, rateDenominator = 1_000_000n): ConversionQuote =>
  conversionQuote(
    "USD",
    "USDC",
    rateNumerator,
    rateDenominator,
    "test",
    "2026-10-31T00:00:00.000Z",
  );

describe("tokens and chains", () => {
  test("identifies a token by contract address, not symbol", () => {
    // A symbol is not unique on-chain; the address is what a transfer uses.
    expect(contractAddress("USDC", 137)).toBe(STABLECOINS.USDC.addresses[137]);
    expect(contractAddress("USDC", 137)).not.toBe(contractAddress("USDC", 1));
  });

  test("knows USDC's six decimals", () => {
    expect(STABLECOINS.USDC.decimals).toBe(6);
  });

  test("only accepts the chains it can send on", () => {
    expect(isChainId(137)).toBe(true);
    expect(isChainId("137")).toBe(false);
    expect(isChainId(999)).toBe(false);
  });
});

describe("addresses", () => {
  test("normalises case so comparisons are stable", () => {
    expect(normalizeAddress(wallet.toUpperCase().replace("0X", "0x"))).toBe(wallet);
  });

  test("rejects anything that is not an address", () => {
    expect(isValidAddress("0x123")).toBe(false);
    expect(isValidAddress("not-an-address")).toBe(false);
    expect(isValidAddress(wallet)).toBe(true);
  });
});

describe("quotes", () => {
  test("refuses a zero or negative rate", () => {
    expect(() => conversionQuote("USD", "USDC", 1n, 0n, "s", "t")).toThrow(/zero denominator/);
    expect(() => conversionQuote("USD", "USDC", 0n, 1n, "s", "t")).toThrow(/must be positive/);
  });

  test("refuses to quote USDC to itself", () => {
    expect(() => conversionQuote("USDC", "USDC", 1n, 1n, "s", "t")).toThrow(/USDC to USDC/);
  });

  test("knows when a quote has expired", () => {
    const now = new Date("2026-10-31T00:00:01.000Z");
    expect(isExpired(quote(), now)).toBe(true);
    expect(isExpired(quote(), new Date("2026-10-30T00:00:00.000Z"))).toBe(false);
  });
});

describe("applyQuote", () => {
  test("converts at a one-to-one rate without losing a digit", () => {
    expect(applyQuote(money(1_250_000, "USD"), quote()).amountMinor).toBe(1_250_000);
  });

  test("applies a discount rate exactly", () => {
    // 0.9995 USDC per USD, as a rational so no digit is lost to a float.
    const discounted = conversionQuote(
      "USD",
      "USDC",
      999_500n,
      1_000_000n,
      "test",
      "2026-10-31T00:00:00.000Z",
    );
    expect(applyQuote(money(1_000_000, "USD"), discounted).amountMinor).toBe(999_500);
  });

  test("rounds half up so a payout is never a unit short", () => {
    const half = conversionQuote("USD", "USDC", 1n, 2n, "test", "2026-10-31T00:00:00.000Z");
    expect(applyQuote(money(3, "USD"), half).amountMinor).toBe(2);
    expect(applyQuote(money(1, "USD"), half).amountMinor).toBe(1);
  });

  test("refuses a quote for a different currency", () => {
    expect(() => applyQuote(money(100, "KES"), quote())).toThrow(/does not cover/);
  });
});

describe("in-memory wallet", () => {
  const funded = (amount = 10_000_000n) => {
    const walletUnderTest = new InMemoryStablecoinWallet();
    walletUnderTest.credit(wallet, money(Number(amount), "USDC"), "USDC", 137);
    return walletUnderTest;
  };

  test("sends a transfer and debits the balance", async () => {
    const ledger = funded();
    const sent = await ledger.send({
      to: wallet,
      amount: money(1_000_000, "USDC"),
      symbol: "USDC",
      chainId: 137,
      idempotencyKey: "payout:1",
    });
    expect(sent.status).toBe("submitted");
    expect(sent.to).toBe(wallet);
    expect((await ledger.balanceOf(wallet, "USDC", 137)).amountMinor).toBe(9_000_000);
  });

  test("is idempotent, so a retried settlement cannot pay twice", async () => {
    // The single most expensive bug in this system: running a settlement twice
    // and sending the payout twice.
    const ledger = funded();
    const request = {
      to: wallet,
      amount: money(1_000_000, "USDC"),
      symbol: "USDC",
      chainId: 137,
      idempotencyKey: "payout:2",
    } as const;
    const first = await ledger.send(request);
    const second = await ledger.send(request);

    expect(second.hash).toBe(first.hash);
    expect(ledger.transfers()).toHaveLength(1);
    expect((await ledger.balanceOf(wallet, "USDC", 137)).amountMinor).toBe(9_000_000);
  });

  test("refuses to overspend", async () => {
    const poor = funded(100n);
    await expect(
      poor.send({
        to: wallet,
        amount: money(1_000_000, "USDC"),
        symbol: "USDC",
        chainId: 137,
        idempotencyKey: "payout:3",
      }),
    ).rejects.toThrow(/Insufficient balance/);
  });

  test("rejects a zero-amount or keyless transfer", async () => {
    const ledger = funded();
    await expect(
      ledger.send({
        to: wallet,
        amount: money(0, "USDC"),
        symbol: "USDC",
        chainId: 137,
        idempotencyKey: "k",
      }),
    ).rejects.toThrow(/positive amount/);
    await expect(
      ledger.send({
        to: wallet,
        amount: money(1, "USDC"),
        symbol: "USDC",
        chainId: 137,
        idempotencyKey: "  ",
      }),
    ).rejects.toThrow(/idempotency key/);
  });

  test("tracks balances per chain", async () => {
    // A balance on one chain says nothing about another, so a send on mainnet
    // must not draw down the polygon balance.
    const ledger = funded();
    ledger.credit(wallet, money(100, "USDC"), "USDC", 1);
    await ledger.send({
      to: wallet,
      amount: money(5, "USDC"),
      symbol: "USDC",
      chainId: 1,
      idempotencyKey: "k1",
    });
    expect((await ledger.balanceOf(wallet, "USDC", 1)).amountMinor).toBe(95);
    expect((await ledger.balanceOf(wallet, "USDC", 137)).amountMinor).toBe(10_000_000);
  });

  test("refuses a negative credit", () => {
    expect(() => funded().credit(wallet, money(-1, "USDC"), "USDC", 137)).toThrow(
      /negative amount/,
    );
  });
});
