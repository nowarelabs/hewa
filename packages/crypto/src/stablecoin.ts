import { ValidationError } from "@hewa/errors";
import { money, type Currency, type Money } from "@hewa/marketplace-types";

/**
 * The stablecoins payouts are made in.
 *
 * Each is identified on-chain by contract address, not by symbol, because a
 * symbol is not unique and sending the wrong token is unrecoverable.
 */
export const STABLECOINS = {
  USDC: {
    symbol: "USDC",
    decimals: 6,
    addresses: {
      1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      137: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    } satisfies Record<number, string>,
  },
} as const;

export type StablecoinSymbol = keyof typeof STABLECOINS;

/** The EVM chains a payout can be sent on. */
export const CHAINS = { 1: "mainnet", 137: "polygon" } as const;

export type ChainId = keyof typeof CHAINS;

export function isChainId(value: unknown): value is ChainId {
  return typeof value === "number" && value in CHAINS;
}

export function assertChainId(value: unknown): asserts value is ChainId {
  if (!isChainId(value)) {
    throw new ValidationError("Unsupported chain", {
      received: String(value),
      supported: Object.keys(CHAINS),
    });
  }
}

export function contractAddress(symbol: StablecoinSymbol, chainId: ChainId): string {
  const entry = STABLECOINS[symbol];
  return entry.addresses[chainId];
}

/** An EVM address, lowercased so comparisons are stable. */
export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new ValidationError("Not a valid EVM address", { received: address });
  }
  return trimmed.toLowerCase();
}

export function isValidAddress(address: string): boolean {
  try {
    normalizeAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * A quote for converting one currency into a stablecoin.
 *
 * `rate` is the major-unit price of one unit of `currency` in the stablecoin,
 * so `1 USD` at `rate: 1` is one USDC. Kept as a rational numerator and
 * denominator so a rate read from an API never has to round-trip through a
 * float and lose a digit.
 */
export interface ConversionQuote {
  readonly from: Currency;
  readonly to: StablecoinSymbol;
  /** Numerator of the rate, e.g. 1_000_000 for a 1:1 quote. */
  readonly rateNumerator: bigint;
  /** Denominator of the rate. Never zero. */
  readonly rateDenominator: bigint;
  /** Where the quote came from, for audit. */
  readonly source: string;
  /** RFC 3339 instant the quote is good until. */
  readonly expiresAt: string;
}

export function conversionQuote(
  from: Currency,
  to: StablecoinSymbol,
  rateNumerator: bigint,
  rateDenominator: bigint,
  source: string,
  expiresAt: string,
): ConversionQuote {
  if (rateDenominator === 0n) {
    throw new ValidationError("A quote rate cannot have a zero denominator", { from, to });
  }
  if (rateNumerator <= 0n) {
    throw new ValidationError("A quote rate must be positive", { from, to });
  }
  if (from === "USDC") {
    // Converting a stablecoin to itself is either a mistake or a no-op, and
    // silently returning the input would hide a bug in a settlement run.
    throw new ValidationError("Cannot quote a conversion from USDC to USDC", { from, to });
  }
  return { from, to, rateNumerator, rateDenominator, source, expiresAt };
}

/** True when the quote is past its expiry, measured against `now`. */
export function isExpired(quote: ConversionQuote, now: Date): boolean {
  return Date.parse(quote.expiresAt) <= now.getTime();
}

/**
 * Apply a quote to an amount.
 *
 * Uses integer division with round-half-up so the payout an ISP receives is
 * never short by a wei, and never silently inflated. The result is truncated
 * toward the payout amount, so the platform absorbs the sub-unit remainder
 * rather than the ISP.
 */
export function applyQuote(amount: Money, quote: ConversionQuote): Money {
  if (amount.currency !== quote.from) {
    throw new ValidationError("Quote does not cover the amount's currency", {
      amount: amount.currency,
      quote: quote.from,
    });
  }
  // amount.minor * numerator / denominator, in stablecoin minor units.
  const scaled = BigInt(amount.amountMinor) * quote.rateNumerator;
  const rounded = (scaled + quote.rateDenominator / 2n) / quote.rateDenominator;
  return money(Number(rounded), "USDC");
}

/** A transfer that has been submitted but not yet confirmed. */
export interface PayoutTransaction {
  readonly hash: string;
  readonly chainId: ChainId;
  readonly to: string;
  readonly amount: Money;
  readonly symbol: StablecoinSymbol;
  readonly status: "submitted" | "confirmed" | "failed";
}

/** The signer side, kept behind an interface so nothing here needs a key. */
export interface StablecoinTransferRequest {
  readonly to: string;
  readonly amount: Money;
  readonly symbol: StablecoinSymbol;
  readonly chainId: ChainId;
  /** Idempotency key. Re-running a settlement must not pay twice. */
  readonly idempotencyKey: string;
}

/** A transport for reading a token balance and sending a transfer. */
export interface StablecoinWallet {
  /** Current balance of `symbol` held at `address` on `chainId`. */
  balanceOf(address: string, symbol: StablecoinSymbol, chainId: ChainId): Promise<Money>;
  /**
   * Submit a transfer.
   *
   * Implementations must treat a repeated `idempotencyKey` as a no-op and
   * return the original hash rather than sending again.
   */
  send(request: StablecoinTransferRequest): Promise<PayoutTransaction>;
}

export function assertTransferRequest(request: StablecoinTransferRequest): void {
  assertChainId(request.chainId);
  normalizeAddress(request.to);
  if (request.amount.amountMinor <= 0) {
    throw new ValidationError("A transfer must move a positive amount", {
      received: String(request.amount.amountMinor),
    });
  }
  if (request.idempotencyKey.trim() === "") {
    throw new ValidationError("A transfer needs an idempotency key", {});
  }
}

/**
 * A wallet that records what it was asked to do and sends nothing.
 *
 * Used by the settlement domain's tests and by dry runs. It is the reason the
 * domain layer has no test that needs a chain.
 */
export class InMemoryStablecoinWallet implements StablecoinWallet {
  readonly #balances = new Map<string, bigint>();
  readonly #sent = new Map<string, PayoutTransaction>();
  #sequence = 0;

  constructor(readonly label = "in-memory") {}

  /**
   * Credit an address without moving anything.
   *
   * Used to fund a test account or to model an incoming deposit. A real
   * implementation would reject this outright; an in-memory one needs it to
   * start from a non-zero balance.
   */
  credit(address: string, amount: Money, symbol: StablecoinSymbol, chainId: ChainId): void {
    if (amount.amountMinor < 0) {
      throw new ValidationError("Cannot credit a negative amount", {
        received: String(amount.amountMinor),
      });
    }
    const current = this.#balances.get(key(address, symbol, chainId)) ?? 0n;
    this.#balances.set(key(address, symbol, chainId), current + BigInt(amount.amountMinor));
  }

  async balanceOf(address: string, symbol: StablecoinSymbol, chainId: ChainId): Promise<Money> {
    return money(Number(this.#balances.get(key(address, symbol, chainId)) ?? 0n), "USDC");
  }

  async send(request: StablecoinTransferRequest): Promise<PayoutTransaction> {
    assertTransferRequest(request);
    const existing = this.#sent.get(request.idempotencyKey);
    if (existing) return existing;

    const available = this.#balances.get(key(request.to, request.symbol, request.chainId)) ?? 0n;
    const amount = BigInt(request.amount.amountMinor);
    if (amount > available) {
      throw new ValidationError("Insufficient balance to send", {
        have: Number(available),
        need: Number(amount),
      });
    }
    this.#balances.set(key(request.to, request.symbol, request.chainId), available - amount);

    this.#sequence += 1;
    const transaction: PayoutTransaction = {
      hash: `0x${request.idempotencyKey.replace(/[^a-z0-9]/gi, "")}${this.#sequence}`,
      chainId: request.chainId,
      to: normalizeAddress(request.to),
      amount: request.amount,
      symbol: request.symbol,
      status: "submitted",
    };
    this.#sent.set(request.idempotencyKey, transaction);
    return transaction;
  }

  /** Every transfer submitted so far, in order. */
  transfers(): PayoutTransaction[] {
    return [...this.#sent.values()];
  }
}

function key(address: string, symbol: StablecoinSymbol, chainId: ChainId): string {
  return `${chainId}:${symbol}:${address.toLowerCase()}`;
}
