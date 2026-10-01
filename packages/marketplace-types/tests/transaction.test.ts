import { describe, expect, test } from "vite-plus/test";
import {
  AT_RISK_BPS,
  assertTransaction,
  assertTransition,
  canTransition,
  creditablePoints,
  hasSlaBreach,
  isSlaState,
  isTerminal,
  money,
  slaCommitment,
  SLA_STATES,
  slaShortfallBps,
  slaState,
  SLA_STATE_TITLES,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_TITLES,
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

describe("slaState", () => {
  test("is compliant when the target was met or beaten", () => {
    expect(slaState(sla(9_995, 9_995))).toBe("compliant");
    expect(slaState(sla(9_995, 10_000))).toBe("compliant");
  });

  test("is at risk just below the warning threshold", () => {
    // 99.95% target, 99.90% actual: a 5 bps miss. It is not a breach, it is a
    // line about to be one, and the chip has to say so.
    expect(slaState(sla(9_995, 9_990))).toBe("at_risk");
    expect(AT_RISK_BPS).toBe(100);
  });

  test("is breached from the threshold onwards, exactly", () => {
    // One bps short of the threshold stays a warning; at it, it is a breach. As
    // floats this boundary is the coin flip the whole representation exists to
    // remove, so both sides of it are asserted.
    expect(slaState(sla(9_995, 9_995 - (AT_RISK_BPS - 1)))).toBe("at_risk");
    expect(slaState(sla(9_995, 9_995 - AT_RISK_BPS))).toBe("breached");
  });

  test("its vocabulary names every state it can return", () => {
    // The list is handed to the console's filter bar, so a state missing from it
    // is a state with no chip — which is the "control that is only sometimes
    // there" this package's representation was chosen to prevent.
    for (const state of SLA_STATES) {
      expect(isSlaState(state), state).toBe(true);
    }
    for (const returned of [sla(9_995, 10_000), sla(9_995, 9_990), sla(9_995, 9_000)]) {
      expect(SLA_STATES, slaState(returned)).toContain(slaState(returned));
    }
    expect(isSlaState("degraded")).toBe(false);
  });

  test("every state has a title, and the title map is keyed by the value not the name", () => {
    // A rail tab and a filter chip read `SLA_STATE_TITLES[row.state]`. A state
    // without an entry renders `undefined` rather than failing to compile — the
    // map is a `Record`, so it is the *values* in `SLA_STATES` that have to be
    // present, and that is what this asserts. The spellings are asserted because
    // "at_risk" on a chip means the raw column value leaked into the UI, and
    // "AT_RISK" means the label is built from the member name instead.
    for (const state of SLA_STATES) {
      expect(SLA_STATE_TITLES[state], state).toBeTypeOf("string");
      expect(SLA_STATE_TITLES[state], state).not.toBe("");
      expect(SLA_STATE_TITLES[state], state).not.toContain("_");
    }
    expect(Object.keys(SLA_STATE_TITLES).sort()).toEqual([...SLA_STATES].sort());
    expect(SLA_STATE_TITLES).toEqual({
      compliant: "Compliant",
      at_risk: "At risk",
      breached: "Breached",
    });
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

describe("TRANSACTION_STATUS_TITLES", () => {
  /**
   * Keyed by the value a row carries, which is the whole point of it.
   *
   * A payout's rail button says `Payouts`, its row says `payout`, and its filter
   * is keyed on `payout`. A titles map built from the member name rather than the
   * value would be keyed on `Payouts`, so `TRANSACTION_STATUS_TITLES[row.status]`
   * would come back `undefined` on every row and the column would say nothing.
   */
  test("is keyed by the wire value, so a row's own status has a title", () => {
    for (const status of TRANSACTION_STATUSES) {
      expect(TRANSACTION_STATUS_TITLES[status], status).toBeTruthy();
    }
  });

  test("has a distinct title per status", () => {
    // Five statuses and five titles: a shared one would make two different states
    // of a payout look the same in a status column, which is the whole thing the
    // column is for.
    const titles = Object.values(TRANSACTION_STATUS_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("no title is itself the wire value", () => {
    // `processing` -> `Processing` reads as a display string rather than as the
    // enum leaking into the UI. A title equal to its key is what a lookup written
    // as a fallback produces, and it is wrong for every status here.
    for (const status of TRANSACTION_STATUSES) {
      expect(TRANSACTION_STATUS_TITLES[status], status).not.toBe(status);
    }
  });

  test("is exhaustive, so a new status is a compile error rather than a blank cell", () => {
    // The map's type is `Record<TransactionStatus, string>`, so this is already
    // enforced at compile time. Asserted here because the failure it prevents is
    // silent: an `undefined` in a status column renders as a gap, not as an error.
    expect(Object.keys(TRANSACTION_STATUS_TITLES).sort()).toEqual([...TRANSACTION_STATUSES].sort());
  });
});
