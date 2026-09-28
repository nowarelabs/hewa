import { describe, expect, test } from "vite-plus/test";
import { usdc, type DayKey } from "@hewa/blockchain-types";
import {
  assertMonth,
  buildReservesReport,
  checkCoverage,
  checkTotals,
  daysInMonth,
  sumAttestedRevenue,
  yesterday,
  type ReservesCheck,
} from "../src/index.ts";
import type { Attestation } from "@hewa/blockchain-types";

const ROOT = `0x${"ab".repeat(32)}` as const;
const DOC = `0x${"cd".repeat(32)}` as const;
const SEPT_2026 = 202609;

const attestation = (day: DayKey, revenue: bigint): Attestation => ({
  record: { city: "johannesburg", day, revenue, ispCount: 1 },
  merkleRoot: ROOT,
  signature: `0x${"11".repeat(32)}${"22".repeat(32)}1b` as const,
});

const check = (over: Partial<ReservesCheck> = {}): ReservesCheck => ({
  city: "johannesburg",
  month: SEPT_2026,
  internalTotal: usdc(100_000),
  onChainTotal: usdc(100_000),
  expectedDays: 30,
  attestedDays: 30,
  ...over,
});

describe("month keys", () => {
  test("accepts a YYYYMM integer", () => {
    expect(assertMonth(SEPT_2026)).toBe(SEPT_2026);
  });

  test("rejects a value that is not a month", () => {
    // A month of revenue and a day of revenue have the same shape and a factor
    // of thirty between them, so a day key must not pass as a month.
    expect(() => assertMonth(20260928)).toThrow(/YYYYMM/);
    expect(() => assertMonth(202613)).toThrow(/YYYYMM/);
    expect(() => assertMonth(202600)).toThrow(/YYYYMM/);
    expect(() => assertMonth(2026)).toThrow(/YYYYMM/);
    expect(() => assertMonth(2026.5)).toThrow(/YYYYMM/);
  });

  test("lists every day of a 30-day month", () => {
    const days = daysInMonth(SEPT_2026);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe(20260901);
    expect(days[29]).toBe(20260930);
  });

  test("counts February in a leap year", () => {
    // 2024 is divisible by four; 2100 is not, 2000 is. Getting this wrong silently
    // drops a day of revenue from the report or invents one.
    expect(daysInMonth(202402)).toHaveLength(29);
    expect(daysInMonth(202602)).toHaveLength(28);
    expect(daysInMonth(210002)).toHaveLength(28);
    expect(daysInMonth(200002)).toHaveLength(29);
  });

  test("handles a 31-day month", () => {
    expect(daysInMonth(202610)).toHaveLength(31);
    expect(daysInMonth(202610).at(-1)).toBe(20261031);
  });
});

describe("summarising a month", () => {
  test("adds the daily attestations exactly", () => {
    const attestations = [attestation(20260901, usdc(1_000)), attestation(20260902, usdc(2_500))];
    expect(sumAttestedRevenue(attestations)).toBe(usdc(3_500));
  });

  test("is zero for a month with nothing on it", () => {
    expect(sumAttestedRevenue([])).toBe(0n);
  });

  test("does not lose a base unit to a float", () => {
    // Three days of figures whose sum is not representable as a double. A float
    // here would make the report disagree with the ledger it is auditing.
    const one = usdc(1) + 1n;
    const attestations = [
      attestation(20260901, one),
      attestation(20260902, one),
      attestation(20260903, one),
    ];
    expect(sumAttestedRevenue(attestations)).toBe(3n * one);
  });
});

describe("coverage", () => {
  test("passes when every day is attested", () => {
    expect(checkCoverage(check())).toEqual([]);
  });

  test("fails a partial month even when the totals happen to match", () => {
    // The dangerous case: a missing day and an offsetting overstatement in
    // another leave the total identical, so a totals-only check passes a month
    // that is missing revenue.
    const partial = check({ attestedDays: 29 });
    expect(checkTotals(partial)).toEqual([]);
    expect(checkCoverage(partial)).toHaveLength(1);
    expect(checkCoverage(partial)[0]).toMatch(/29 of 30/);
  });

  test("fails an empty month", () => {
    expect(
      checkCoverage(check({ attestedDays: 0, onChainTotal: 0n, internalTotal: 0n }))[0],
    ).toMatch(/0 of 30/);
  });
});

describe("totals", () => {
  test("passes when the books and the chain agree", () => {
    expect(checkTotals(check())).toEqual([]);
  });

  test("fails by one base unit, which is a millionth of a cent", () => {
    // A tolerance here would be a hole. The comparison is exact because both
    // sides are integers, and there is no rounding left to excuse a difference.
    const off = check({ internalTotal: usdc(100_000) + 1n });
    expect(checkTotals(off)).toHaveLength(1);
    expect(checkTotals(off)[0]).toMatch(/does not match on-chain/);
  });

  test("fails when the books exceed what was published", () => {
    expect(checkTotals(check({ internalTotal: usdc(200_000) }))).toHaveLength(1);
  });

  test("fails when the books fall short of what was published", () => {
    expect(checkTotals(check({ internalTotal: usdc(1) }))).toHaveLength(1);
  });
});

describe("a reserves report", () => {
  const attestations = [attestation(20260901, usdc(60_000)), attestation(20260902, usdc(40_000))];

  test("issues when the books match and every day is covered", () => {
    const verdict = buildReservesReport(check(), attestations, usdc(10_000), ROOT, DOC);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.report.grossRevenue).toBe(usdc(100_000));
    expect(verdict.report.operatingCosts).toBe(usdc(10_000));
    expect(verdict.report.netRevenue).toBe(usdc(90_000));
    expect(verdict.report.merkleRoot).toBe(ROOT);
    expect(verdict.report.documentHash).toBe(DOC);
    expect(verdict.report.month).toBe(SEPT_2026);
  });

  test("refuses to issue when the totals disagree, and says which way", () => {
    // Signed, so a reader can tell an understatement from an overstatement
    // without re-deriving it from the two totals.
    const short = buildReservesReport(
      check({ internalTotal: usdc(90_000) }),
      attestations,
      usdc(10_000),
      ROOT,
      DOC,
    );
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.difference).toBe(-usdc(10_000));
    expect(short.ok ? "" : short.reasons.join(" ")).toMatch(/does not match/);

    const over = buildReservesReport(
      check({ internalTotal: usdc(110_000) }),
      attestations,
      usdc(10_000),
      ROOT,
      DOC,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.difference).toBe(usdc(10_000));
  });

  test("refuses to issue for a month with a day missing", () => {
    const verdict = buildReservesReport(
      check({ attestedDays: 29 }),
      attestations,
      usdc(10_000),
      ROOT,
      DOC,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reasons.join(" ")).toMatch(/29 of 30/);
  });

  test("reports both faults at once rather than the first", () => {
    // An operator fixing a report wants the whole list, not one problem per
    // resubmission.
    const verdict = buildReservesReport(
      check({ internalTotal: usdc(1), attestedDays: 3 }),
      attestations,
      usdc(1),
      ROOT,
      DOC,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reasons).toHaveLength(2);
  });

  test("floors net revenue at zero rather than reporting a loss as revenue", () => {
    // A negative net would underflow the payout calculation on chain, where it
    // cannot be represented at all.
    const verdict = buildReservesReport(check(), attestations, usdc(150_000), ROOT, DOC);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.report.netRevenue).toBe(0n);
    expect(verdict.report.operatingCosts).toBe(usdc(150_000));
  });

  test("rejects operating costs that are not a non-negative bigint", () => {
    expect(() => buildReservesReport(check(), attestations, -1n, ROOT, DOC)).toThrow(/negative/);
    // A float here is the money bug this repository is built to prevent:
    // `usdc(1) * 3` is a figure a double cannot represent, so a cost that
    // arrives as a number has already lost precision before anything checks it.
    const asNumber = 3_000_001 as unknown as bigint;
    expect(() => buildReservesReport(check(), attestations, asNumber, ROOT, DOC)).toThrow(/bigint/);
  });
});

describe("the day to attest", () => {
  test("is yesterday in UTC", () => {
    // UTC, not local: a settlement run that shifts a day twice a year is a run
    // that attests a day that has not finished, or skips one entirely.
    expect(yesterday(new Date("2026-09-28T00:00:00.000Z"))).toBe(20260927);
    expect(yesterday(new Date("2026-10-01T00:00:00.000Z"))).toBe(20260930);
  });

  test("handles the month and year boundaries", () => {
    expect(yesterday(new Date("2026-10-01T12:00:00.000Z"))).toBe(20260930);
    expect(yesterday(new Date("2027-01-01T00:00:00.000Z"))).toBe(20261231);
    expect(yesterday(new Date("2026-03-01T00:00:00.000Z"))).toBe(20260228);
  });

  test("does not shift across a DST boundary, because it is UTC", () => {
    // Northern-hemisphere DST in 2026 begins 29 March. A local-time
    // implementation loses or repeats a day here.
    expect(yesterday(new Date("2026-03-29T00:30:00.000Z"))).toBe(20260328);
    expect(yesterday(new Date("2026-11-01T00:30:00.000Z"))).toBe(20261031);
  });
});
