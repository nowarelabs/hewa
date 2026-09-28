import { describe, expect, test } from "vite-plus/test";
import {
  assertTransaction,
  assertTransition,
  canTransition,
  creditablePoints,
  hasSlaBreach,
  isTerminal,
  money,
  slaCommitment,
  slaShortfallBps,
  type Transaction,
} from "../src/index.ts";

const sla = (targetBps: number, actualBps: number) => slaCommitment(targetBps, actualBps, 1, 10);

describe("SLA", () => {
  test("rejects a percentage that was entered as a percentage, not bps", () => {
    // 99.5 and 9_950 are the same availability to a human and wildly different
    // to a comparison, and only the second is a valid basis point count. A
    // percentage typed where bps belong has to be rejected loudly, because
    // accepted silently it would read as 0.995%.
    expect(() => sla(99.5, 98.2)).toThrow(/whole number of basis points/);
    expect(() => sla(9_995, 9_995.5)).toThrow(/whole number of basis points/);
  });

  test("detects a breach", () => {
    expect(hasSlaBreach(sla(9_995, 9_800))).toBe(true);
    expect(hasSlaBreach(sla(9_995, 9_999))).toBe(false);
  });

  test("measures the shortfall in basis points, exactly", () => {
    // 99.5% against 98.2% is 175 bps. As fractions the same subtraction is
    // 1.2999999999999545, and a comparison against a whole point is a coin flip.
    expect(slaShortfallBps(sla(9_995, 9_820))).toBe(175);
    expect(slaShortfallBps(sla(9_995, 10_000))).toBe(0);
  });

  test("credits only whole points", () => {
    expect(creditablePoints(sla(9_995, 9_820))).toBe(1);
    // 20 bps is a real shortfall that bills at zero, which is why the residual
    // still shows up in the bps figure above.
    expect(creditablePoints(sla(9_995, 9_975))).toBe(0);
  });

  test("credits a whole-point shortfall with no float tolerance", () => {
    // The case an epsilon had to paper over: exactly ten points.
    expect(creditablePoints(sla(10_000, 9_000))).toBe(10);
  });
});

const transaction: Transaction = {
  id: "txn_1",
  ispId: "isp_1",
  type: "payout",
  amount: money(1_250_000, "USDC"),
  status: "pending",
  occurredAt: "2026-10-15T09:00:00.000Z",
  reference: "req_1",
};

describe("transaction lifecycle", () => {
  test("walks the happy path", () => {
    expect(canTransition("pending", "processing")).toBe(true);
    expect(canTransition("processing", "completed")).toBe(true);
  });

  test("allows a retry of a failure but not a completed transfer", () => {
    expect(canTransition("failed", "pending")).toBe(true);
    // Re-paying a settled transfer is how an ISP gets paid twice.
    expect(canTransition("completed", "processing")).toBe(false);
  });

  test("refuses to rewind a transfer that is in flight", () => {
    expect(() => assertTransition("processing", "pending")).toThrow(/Illegal/);
  });

  test("treats completed, failed and reversed as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("reversed")).toBe(true);
    expect(isTerminal("pending")).toBe(false);
  });
});

describe("assertTransaction", () => {
  test("accepts a well-formed transaction", () => {
    expect(assertTransaction(transaction)).toBe(transaction);
  });

  test("rejects a zero-value movement", () => {
    // A zero row in a ledger is noise that still has to balance.
    expect(() => assertTransaction({ ...transaction, amount: money(0, "USDC") })).toThrow(
      /cannot move zero/,
    );
  });

  test("requires a correlation reference", () => {
    expect(() => assertTransaction({ ...transaction, reference: "" })).toThrow(
      /correlation reference/,
    );
  });

  test("rejects an unknown status", () => {
    expect(() => assertTransaction({ ...transaction, status: "settled" as never })).toThrow(
      /Unsupported transaction status/,
    );
  });
});
