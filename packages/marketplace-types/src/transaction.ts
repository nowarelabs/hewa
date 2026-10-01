import { ValidationError } from "@hewa/errors";
import type { Money } from "./money.ts";

/**
 * The kinds of movement the ledger can record.
 *
 * `charge` is what an ISP owes, `payout` is what it has been sent, and
 * `credit` is a reversal — an SLA credit, a reconciliation adjustment, or a
 * refund. Everything is a signed amount; the ledger derives direction from the
 * accounts it touches, not from the type.
 */
export const TRANSACTION_TYPES = ["charge", "payout", "credit"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const TRANSACTION_TYPE_SET: ReadonlySet<string> = new Set(TRANSACTION_TYPES);

export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && TRANSACTION_TYPE_SET.has(value);
}

/**
 * A payment's lifecycle.
 *
 * `failed` is terminal and distinct from `reversed`: a failed transfer can be
 * retried on the next settlement run, a reversal must be journaled.
 */
export const TRANSACTION_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "reversed",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

const TRANSACTION_STATUS_SET: ReadonlySet<string> = new Set(TRANSACTION_STATUSES);

/**
 * How each status is written where a human reads it.
 *
 * Keyed by the **value** a row carries, like every other titles map here, so a
 * panel writes `Failed` while its filter is keyed on `failed`. Built from the
 * member name it would read `Failed` for two of the five and `Reversed` for
 * three, which is a coincidence rather than a decision.
 *
 * A `Record<TransactionStatus, string>` rather than a partial one, so a status
 * added to `TRANSACTION_STATUSES` without a title is a compile error here and not
 * an `undefined` in a status column.
 */
export const TRANSACTION_STATUS_TITLES: Readonly<Record<TransactionStatus, string>> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  reversed: "Reversed",
};

export function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === "string" && TRANSACTION_STATUS_SET.has(value);
}

/** A single movement of value against an ISP. */
export interface Transaction {
  readonly id: string;
  readonly ispId: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly status: TransactionStatus;
  /** RFC 3339 instant. A string, because this crosses a JSON boundary. */
  readonly occurredAt: string;
  /** Correlation id, matching the `x-request-id` on the originating call. */
  readonly reference: string;
}

/** A status from which no further transition is allowed. */
export function isTerminal(status: TransactionStatus): boolean {
  return status === "completed" || status === "failed" || status === "reversed";
}

const ALLOWED_TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  pending: ["processing", "failed", "reversed"],
  processing: ["completed", "failed"],
  completed: [],
  failed: ["pending"],
  reversed: [],
};

/**
 * Guard a status change against the lifecycle.
 *
 * Settlements retry, and a retry that flips `processing` back to `pending`
 * halfway through a transfer is how an ISP gets paid twice. Callers are
 * expected to catch this and treat the transaction as already settled.
 */
export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransition(from, to)) {
    throw new ValidationError("Illegal transaction status transition", { from, to });
  }
}

export function assertTransaction(value: Transaction): Transaction {
  if (!isTransactionType(value.type)) {
    throw new ValidationError("Unsupported transaction type", {
      id: value.id,
      received: String(value.type),
    });
  }
  if (!isTransactionStatus(value.status)) {
    throw new ValidationError("Unsupported transaction status", {
      id: value.id,
      received: String(value.status),
    });
  }
  if (value.amount.amountMinor === 0) {
    throw new ValidationError("A transaction cannot move zero value", { id: value.id });
  }
  if (value.reference.trim() === "") {
    throw new ValidationError("A transaction needs a correlation reference", { id: value.id });
  }
  return value;
}
