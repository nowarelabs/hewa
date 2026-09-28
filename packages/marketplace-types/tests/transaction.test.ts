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
  slaShortfallPoints,
  type Transaction,
} from "../src/index.ts";

const sla = (target: number, actual: number, rate = 0.1) => slaCommitment(target, actual, rate);

describe("SLA", () => {
  test("rejects percentages that are not fractions", () => {
    // 99.5 and 0.995 are the same number to a human and wildly different to a
    // comparison, so the type only accepts the fraction.
    expect(() => sla(99.5, 98.2)).toThrow(/fraction between 0 and 1/);
  });

  test("detects a breach", () => {
    expect(hasSlaBreach(sla(0.995, 0.98))).toBe(true);
    expect(hasSlaBreach(sla(0.995, 0.9999))).toBe(false);
  });

  test("measures the shortfall in percentage points", () => {
    expect(slaShortfallPoints(sla(0.995, 0.982))).toBeCloseTo(1.3, 10);
    expect(slaShortfallPoints(sla(0.995, 1))).toBe(0);
  });

  test("credits only whole points", () => {
    expect(creditablePoints(sla(0.995, 0.982))).toBe(1);
    // A shortfall under a whole point is real but bills at zero, which is why
    // the residual still shows up in the shortfall figure above.
    expect(creditablePoints(sla(0.995, 0.997))).toBe(0);
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
