import { describe, expect, test } from "vite-plus/test";
import { money } from "@hewa/marketplace-types";
import { conversionQuote, InMemoryStablecoinWallet } from "@hewa/crypto";
import {
  assertNoDuplicateReferences,
  canTransitionPayout,
  convertPayout,
  outstanding,
  payoutObligation,
  prepareTransfer,
  settlePayout,
  totalConverted,
  totalObligations,
  type PayoutObligation,
} from "../src/index.ts";

const destination = "0x1234567890abcdef1234567890abcdef12345678";
const now = new Date("2026-10-15T09:00:00.000Z");
const liveQuote = conversionQuote(
  "USD",
  "USDC",
  999_500n,
  1_000_000n,
  "test",
  "2026-10-15T09:05:00.000Z",
);
const staleQuote = conversionQuote(
  "USD",
  "USDC",
  999_500n,
  1_000_000n,
  "test",
  "2026-10-15T08:00:00.000Z",
);

const obligation = (id: string, minor = 1_250_000, to: string | null = destination) =>
  payoutObligation(id, "isp_1", money(minor, "USD"), to, `bill:2026-10:${id}`);

describe("obligation", () => {
  test("starts pending, unconverted, in USD", () => {
    const payout = obligation("po_1");
    expect(payout.status).toBe("pending");
    expect(payout.convertedAmount).toBeNull();
    expect(payout.amount.currency).toBe("USD");
  });

  test("refuses a non-positive or non-USD obligation", () => {
    expect(() => payoutObligation("po", "isp", money(0, "USD"), destination, "r")).toThrow(
      /positive amount/,
    );
    expect(() => payoutObligation("po", "isp", money(100, "KES"), destination, "r")).toThrow(
      /denominated in USD/,
    );
  });

  test("requires a reference back to the bill", () => {
    expect(() => payoutObligation("po", "isp", money(100, "USD"), destination, " ")).toThrow(
      /reference back to its bill/,
    );
  });
});

describe("status machine", () => {
  test("walks pending to completed", () => {
    expect(canTransitionPayout("pending", "converting")).toBe(true);
    expect(canTransitionPayout("converting", "sending")).toBe(true);
    expect(canTransitionPayout("sending", "completed")).toBe(true);
  });

  test("will not re-open a completed payout", () => {
    // Re-sending a settled payout is the expensive failure this guards.
    expect(canTransitionPayout("completed", "sending")).toBe(false);
    expect(canTransitionPayout("sending", "pending")).toBe(false);
  });
});

describe("conversion", () => {
  test("applies the quote and records it for audit", () => {
    // 1,250,000 cents at 0.9995 is 1,249,375 USDC units.
    const converted = convertPayout(obligation("po_1"), liveQuote, now);
    expect(converted.convertedAmount?.amountMinor).toBe(1_249_375);
    expect(converted.quote?.rateNumerator).toBe(999_500n);
  });

  test("refuses an expired quote", () => {
    // Paying at last week's rate is how a settlement becomes indefensible.
    expect(() => convertPayout(obligation("po_1"), staleQuote, now)).toThrow(/expired quote/);
  });

  test("refuses to convert twice", () => {
    const converted = convertPayout(obligation("po_1"), liveQuote, now);
    expect(() => convertPayout(converted, liveQuote, now)).toThrow(/already been converted/);
  });
});

describe("transfer preparation", () => {
  test("derives a stable idempotency key from the payout", () => {
    const converted = convertPayout(obligation("po_1"), liveQuote, now);
    const { request } = prepareTransfer(converted);
    // Derived, not generated: re-running the batch must reuse it.
    expect(request.idempotencyKey).toBe("payout:po_1");
    expect(request.chainId).toBe(137);
  });

  test("refuses to send an unconverted payout", () => {
    expect(() => prepareTransfer(obligation("po_1"))).toThrow(/converted before/);
  });

  test("refuses a payout with no wallet address", () => {
    const converted = convertPayout(obligation("po_1", 1_250_000, null), liveQuote, now);
    expect(() => prepareTransfer(converted)).toThrow(/no destination/);
  });
});

describe("settlePayout", () => {
  test("sends once and reports the transfer", async () => {
    const walletUnderTest = new InMemoryStablecoinWallet();
    walletUnderTest.credit(destination, money(10_000_000, "USDC"), "USDC", 137);

    const result = await settlePayout(walletUnderTest, obligation("po_1"), liveQuote, now);

    expect(result.obligation.status).toBe("sending");
    expect(result.transaction.amount.amountMinor).toBe(1_249_375);
    expect(walletUnderTest.transfers()).toHaveLength(1);
  });

  test("is idempotent across a retried settlement run", async () => {
    const walletUnderTest = new InMemoryStablecoinWallet();
    walletUnderTest.credit(destination, money(10_000_000, "USDC"), "USDC", 137);

    await settlePayout(walletUnderTest, obligation("po_1"), liveQuote, now);
    await settlePayout(walletUnderTest, obligation("po_1"), liveQuote, now);

    // Same payout id, same idempotency key, so the second run must not pay.
    expect(walletUnderTest.transfers()).toHaveLength(1);
  });

  test("rejects a wallet that sends a different amount than requested", async () => {
    const converted = convertPayout(obligation("po_1"), liveQuote, now);
    const { markSent } = await import("../src/settlement.ts");
    expect(() =>
      markSent(converted, {
        hash: "0xabc",
        chainId: 137,
        to: destination,
        amount: money(999, "USDC"),
        symbol: "USDC",
        status: "submitted",
      }),
    ).toThrow(/does not match the obligation/);
  });
});

describe("batch totals", () => {
  const batch: PayoutObligation[] = [obligation("po_1", 1_000_000), obligation("po_2", 2_000_000)];

  test("totals the USD obligation", () => {
    expect(totalObligations(batch).amountMinor).toBe(3_000_000);
  });

  test("totals zero for an empty batch", () => {
    expect(totalObligations([]).amountMinor).toBe(0);
  });

  test("totals only the converted amounts", () => {
    const converted = [convertPayout(batch[0]!, liveQuote, now), batch[1]!];
    expect(totalConverted(converted).amountMinor).toBe(999_500);
  });

  test("rejects a batch that settles the same bill twice", () => {
    // Running a batch twice and totalling both is how an ISP is paid twice.
    const doubled = [obligation("po_1", 1_000_000), obligation("po_2", 1_000_000, destination)];
    expect(() => assertNoDuplicateReferences(doubled)).not.toThrow();

    const clash = [
      payoutObligation("po_1", "isp_1", money(100, "USD"), destination, "bill:2026-10"),
      payoutObligation("po_2", "isp_1", money(100, "USD"), destination, "bill:2026-10"),
    ];
    expect(() => assertNoDuplicateReferences(clash)).toThrow(/settles a bill twice/);
  });
});

describe("outstanding", () => {
  test("nets what is still owed", () => {
    expect(outstanding(money(3_000_000, "USD"), money(1_000_000, "USD")).amountMinor).toBe(
      2_000_000,
    );
  });
});
