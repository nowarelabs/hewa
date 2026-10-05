import { ValidationError } from "@hewa/errors";
import { subtractMoney, sumMoney, zero, type Currency, type Money } from "@hewa/marketplace-types";
import {
  applyQuote,
  assertTransferRequest,
  isExpired,
  type ChainId,
  type ConversionQuote,
  type PayoutTransaction,
  type StablecoinSymbol,
  type StablecoinWallet,
} from "@hewa/crypto";

/** What a payout is doing right now. */
export const PAYOUT_STATUSES = ["pending", "converting", "sending", "completed", "failed"] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * How each status is written where a human reads it.
 *
 * Keyed by the **value** a row carries rather than by the member name, so a panel
 * writes "Converting" while its filter is keyed on `converting`. Built from the
 * member name it would read "Converting" for one of the five and "Failed" for
 * another by coincidence, and "Payoutstatus.Completed" for the rest.
 *
 * A `Record<PayoutStatus, string>` rather than a partial one, so a status added to
 * `PAYOUT_STATUSES` without a title is a compile error here and not an `undefined`
 * in a status column.
 */
export const PAYOUT_STATUS_TITLES: Readonly<Record<PayoutStatus, string>> = {
  pending: "Pending",
  converting: "Converting",
  sending: "Sending",
  completed: "Completed",
  failed: "Failed",
};

const PAYOUT_STATUS_SET: ReadonlySet<string> = new Set(PAYOUT_STATUSES);

export function isPayoutStatus(value: unknown): value is PayoutStatus {
  return typeof value === "string" && PAYOUT_STATUS_SET.has(value);
}

/**
 * What an ISP is owed, and where it is going.
 *
 * `amount` is always the USD obligation. The stablecoin amount only exists once
 * a quote has been taken, and is recorded alongside the quote so a payout can
 * be re-derived later and the two compared.
 */
export interface PayoutObligation {
  readonly id: string;
  readonly ispId: string;
  /** The amount owed, in USD. */
  readonly amount: Money;
  /** Stablecoin amount, set once converted. */
  readonly convertedAmount: Money | null;
  readonly quote: ConversionQuote | null;
  /** EVM address, or null when the ISP is paid by bank transfer. */
  readonly destination: string | null;
  readonly chainId: ChainId;
  readonly symbol: StablecoinSymbol;
  readonly status: PayoutStatus;
  /** Correlation id tying the payout back to the bill it settles. */
  readonly reference: string;
}

const ALLOWED_PAYOUT_TRANSITIONS: Readonly<Record<PayoutStatus, readonly PayoutStatus[]>> = {
  pending: ["converting", "failed"],
  converting: ["sending", "failed"],
  sending: ["completed", "failed"],
  completed: [],
  failed: ["pending"],
};

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return ALLOWED_PAYOUT_TRANSITIONS[from].includes(to);
}

export function assertPayoutTransition(from: PayoutStatus, to: PayoutStatus): void {
  if (!canTransitionPayout(from, to)) {
    throw new ValidationError("Illegal payout status transition", { from, to });
  }
}

export function payoutObligation(
  id: string,
  ispId: string,
  amount: Money,
  destination: string | null,
  reference: string,
): PayoutObligation {
  if (amount.amountMinor <= 0) {
    throw new ValidationError("A payout must be for a positive amount", {
      id,
      received: String(amount.amountMinor),
    });
  }
  if (amount.currency !== "USD") {
    // USD is the unit of account. A payout quoted in anything else has already
    // gone wrong somewhere upstream.
    throw new ValidationError("A payout obligation is denominated in USD", {
      id,
      received: amount.currency,
    });
  }
  if (reference.trim() === "") {
    throw new ValidationError("A payout needs a reference back to its bill", { id });
  }
  return {
    id,
    ispId,
    amount,
    convertedAmount: null,
    quote: null,
    destination,
    chainId: 137,
    symbol: "USDC",
    status: "pending",
    reference,
  };
}

/**
 * Take a quote and produce the stablecoin amount.
 *
 * The quote is stored on the obligation rather than discarded, so the rate used
 * is auditable months later. An expired quote is rejected outright: paying at
 * last week's rate is how a settlement ends up quoting a rate nobody can defend.
 */
export function convertPayout(
  obligation: PayoutObligation,
  quote: ConversionQuote,
  now: Date,
): PayoutObligation {
  // Checked before the transition so the error names the real problem:
  // converting twice would quietly change what the ISP receives.
  if (obligation.convertedAmount !== null) {
    throw new ValidationError("Payout has already been converted", { payoutId: obligation.id });
  }
  assertPayoutTransition(obligation.status, "converting");
  if (isExpired(quote, now)) {
    throw new ValidationError("Refusing to settle against an expired quote", {
      payoutId: obligation.id,
      expiresAt: quote.expiresAt,
      now: now.toISOString(),
    });
  }
  return {
    ...obligation,
    status: "converting",
    quote,
    convertedAmount: applyQuote(obligation.amount, quote),
  };
}

/**
 * A payout that is ready to send.
 *
 * Fails if the obligation was never converted or has no destination, so a
 * settlement run cannot submit a transfer with a missing amount.
 */
export function prepareTransfer(obligation: PayoutObligation): {
  readonly request: {
    readonly to: string;
    readonly amount: Money;
    readonly symbol: StablecoinSymbol;
    readonly chainId: ChainId;
    readonly idempotencyKey: string;
  };
  readonly status: PayoutStatus;
} {
  if (obligation.convertedAmount === null) {
    throw new ValidationError("Payout must be converted before it can be sent", {
      payoutId: obligation.id,
      status: obligation.status,
    });
  }
  if (obligation.destination === null) {
    throw new ValidationError("Payout has no destination", { payoutId: obligation.id });
  }
  const request = {
    to: obligation.destination,
    amount: obligation.convertedAmount,
    symbol: obligation.symbol,
    chainId: obligation.chainId,
    // Derived from the payout, not generated: re-running a settlement for the
    // same obligation must reuse the same key.
    idempotencyKey: `payout:${obligation.id}`,
  };
  assertTransferRequest(request);
  return { request, status: "sending" };
}

/** Record a submitted transfer against the obligation. */
export function markSent(
  obligation: PayoutObligation,
  transaction: PayoutTransaction,
): PayoutObligation {
  assertPayoutTransition(obligation.status, "sending");
  if (transaction.amount.currency !== "USDC") {
    throw new ValidationError("Transfer amount is not a stablecoin amount", {
      payoutId: obligation.id,
      received: transaction.amount.currency,
    });
  }
  if (
    obligation.convertedAmount !== null &&
    transaction.amount.amountMinor !== obligation.convertedAmount.amountMinor
  ) {
    // A wallet that sends a different amount than it was asked for is either
    // misconfigured or compromised; neither should be journaled as success.
    throw new ValidationError("Transfer amount does not match the obligation", {
      payoutId: obligation.id,
      expected: obligation.convertedAmount.amountMinor,
      received: transaction.amount.amountMinor,
    });
  }
  return { ...obligation, status: "sending" };
}

export function markCompleted(obligation: PayoutObligation): PayoutObligation {
  assertPayoutTransition(obligation.status, "completed");
  return { ...obligation, status: "completed" };
}

/** Send a payout end to end, or fail loudly. */
export async function settlePayout(
  wallet: StablecoinWallet,
  obligation: PayoutObligation,
  quote: ConversionQuote,
  now: Date,
): Promise<{ readonly obligation: PayoutObligation; readonly transaction: PayoutTransaction }> {
  const converted = convertPayout(obligation, quote, now);
  const { request } = prepareTransfer(converted);
  const transaction = await wallet.send(request);
  const sent = markSent(converted, transaction);
  return { obligation: sent, transaction };
}

/**
 * Total the obligations in a settlement run, in USD.
 *
 * This is the number that must agree with the ledger. Running the same batch
 * twice and totalling both runs is how an ISP gets paid twice, so the caller is
 * expected to deduplicate on `reference` before calling this.
 */
export function totalObligations(obligations: readonly PayoutObligation[]): Money {
  if (obligations.length === 0) return zero("USD");
  return sumMoney(
    obligations.map((obligation) => obligation.amount),
    "USD",
  );
}

/** Reject a batch that settles the same bill twice. */
export function assertNoDuplicateReferences(obligations: readonly PayoutObligation[]): void {
  const seen = new Set<string>();
  for (const obligation of obligations) {
    if (seen.has(obligation.reference)) {
      throw new ValidationError("Settlement batch settles a bill twice", {
        reference: obligation.reference,
        payoutId: obligation.id,
      });
    }
    seen.add(obligation.reference);
  }
}

/** What is still owed to an ISP after a payment. */
export function outstanding(owed: Money, paid: Money): Money {
  return subtractMoney(owed, paid);
}

/** Currencies an obligation may be settled into. */
export const SETTLEMENT_CURRENCIES: readonly Currency[] = ["USDC"];

/** Sum the stablecoin amounts of a batch, skipping anything unconverted. */
export function totalConverted(obligations: readonly PayoutObligation[]): Money {
  const converted = obligations
    .map((obligation) => obligation.convertedAmount)
    .filter((amount): amount is Money => amount !== null);
  return sumMoney(converted, "USDC");
}
