import { describe, expect, test } from "vite-plus/test";
import {
  creditablePoints,
  formatBps,
  money,
  slaCommitment,
  slaShortfallBps,
} from "../src/index.ts";
import {
  assertBandwidth,
  availableCapacity,
  hasCapacityFor,
  isBssOssSystem,
  supportsStablecoinPayout,
  type Bandwidth,
  type Isp,
} from "../src/marketplace.ts";

const listing: Bandwidth = {
  id: "bw_1",
  supplierId: "sup_1",
  committedMbps: 100,
  burstMbps: 200,
  location: "Nairobi",
  price: money(30_000, "USD"),
  sla: slaCommitment(9_995, 10_000, 1, 10),
};

const isp: Isp = {
  id: "isp_1",
  name: "Example Networks",
  location: "Mombasa",
  bankDetails: {
    bankCode: "KCB",
    accountNumber: "1234567890",
    accountName: "Example Networks Ltd",
    currency: "KES",
  },
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  bssOssSystem: "Openet",
  bssOssApiKey: "key",
};

describe("assertBandwidth", () => {
  test("accepts a well-formed listing", () => {
    expect(assertBandwidth(listing)).toBe(listing);
  });

  test("rejects burst below the commitment", () => {
    // Otherwise the overage calculation has a negative range to work with.
    expect(() => assertBandwidth({ ...listing, burstMbps: 50 })).toThrow(/below the commitment/);
  });

  test("rejects a negative price and a missing location", () => {
    expect(() => assertBandwidth({ ...listing, price: money(-1, "USD") })).toThrow(
      /cannot be negative/,
    );
    expect(() => assertBandwidth({ ...listing, location: "  " })).toThrow(/must have a location/);
  });
});

describe("capacity", () => {
  test("reports what is still unsold", () => {
    expect(availableCapacity({ totalMbps: 10_000, soldMbps: 6_000 })).toBe(4_000);
  });

  test("refuses to oversell", () => {
    const capacity = { totalMbps: 10_000, soldMbps: 6_000 };
    expect(hasCapacityFor(capacity, 4_000)).toBe(true);
    expect(hasCapacityFor(capacity, 4_001)).toBe(false);
  });

  test("rejects a negative request", () => {
    expect(() => hasCapacityFor({ totalMbps: 10, soldMbps: 0 }, -5)).toThrow(/cannot be negative/);
  });
});

describe("ISP", () => {
  test("accepts a well-formed record", () => {
    expect(supportsStablecoinPayout(isp)).toBe(true);
  });

  test("treats a missing or blank wallet as no stablecoin payout", () => {
    expect(supportsStablecoinPayout({ ...isp, walletAddress: null })).toBe(false);
    expect(supportsStablecoinPayout({ ...isp, walletAddress: "  " })).toBe(false);
  });

  test("only recognises the BSS/OSS systems it has an adapter for", () => {
    expect(isBssOssSystem("Amdocs")).toBe(true);
    expect(isBssOssSystem("Openet")).toBe(true);
    expect(isBssOssSystem("Custom")).toBe(true);
    // An unknown suite means nobody knows how to sync, so it must not pass.
    expect(isBssOssSystem("Netcracker")).toBe(false);
  });
});

describe("creditable points", () => {
  test("credits a whole-number shortfall in full", () => {
    // As fractions this is `(1 - 0.9) * 100`, which is 9.999999999999998, so
    // flooring it unaided reports 9 points on the cleanest possible case.
    expect(creditablePoints(slaCommitment(10_000, 9_000, 1, 20))).toBe(10);
    expect(creditablePoints(slaCommitment(9_950, 9_000, 1, 20))).toBe(9);
    expect(creditablePoints(slaCommitment(9_900, 9_000, 1, 20))).toBe(9);
  });

  test("still credits nothing for a genuine sub-point shortfall", () => {
    // 20 bps is not a point, and no tolerance may promote it to one.
    expect(creditablePoints(slaCommitment(9_970, 9_950, 1, 10))).toBe(0);
    expect(creditablePoints(slaCommitment(10_000, 9_999, 1, 10))).toBe(0);
  });

  test("credits nothing when the target was met or exceeded", () => {
    expect(creditablePoints(slaCommitment(9_950, 9_950, 1, 10))).toBe(0);
    expect(creditablePoints(slaCommitment(9_950, 9_990, 1, 10))).toBe(0);
  });

  test("reports the shortfall exactly, in basis points", () => {
    // 99.95% against 98.20% is 175 bps. As fractions the same subtraction is
    // subject to representation error; as integers it is not.
    expect(slaShortfallBps(slaCommitment(9_995, 9_820, 1, 20))).toBe(175);
  });

  test("rejects an availability that is not a whole number of bps", () => {
    // 9995.5 is inside the range and is not a representable availability.
    expect(() => slaCommitment(9_995.5, 9_800, 1, 20)).toThrow(/whole number of basis points/);
    expect(() => slaCommitment(-1, 9_800, 1, 20)).toThrow(/whole number of basis points/);
    expect(() => slaCommitment(10_001, 9_800, 1, 20)).toThrow(/whole number of basis points/);
  });

  test("formats bps the way a counterparty reads them", () => {
    expect(formatBps(9_995)).toBe("99.95%");
    expect(formatBps(10_000)).toBe("100.00%");
    expect(formatBps(5)).toBe("0.05%");
    expect(formatBps(0)).toBe("0.00%");
  });
});
