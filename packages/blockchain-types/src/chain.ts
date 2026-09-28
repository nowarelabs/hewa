import { ValidationError } from "@hewa/errors";

/**
 * Chains we settle and attest on.
 *
 * A `ChainId` is a number because that is what an EVM RPC and a Solidity
 * `uint256` both use. It is not a `bigint`, so a value that does not fit in a
 * JavaScript number cannot be represented at all rather than being silently
 * truncated.
 */
export const CHAIN_IDS = {
  1: "Ethereum",
  10: "OP Mainnet",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum One",
} as const;

export type ChainId = keyof typeof CHAIN_IDS;

const CHAIN_SET: ReadonlySet<number> = new Set(Object.keys(CHAIN_IDS).map(Number));

export function isChainId(value: unknown): value is ChainId {
  return typeof value === "number" && CHAIN_SET.has(value);
}

export function assertChainId(value: unknown): ChainId {
  if (!isChainId(value)) {
    throw new ValidationError("Unknown chain id", { received: String(value) });
  }
  return value;
}

export function chainName(chainId: ChainId): string {
  return CHAIN_IDS[chainId];
}

/**
 * An amount in the smallest unit of a token, as a `bigint`.
 *
 * This is the type that crosses the boundary between the ledger and a contract.
 * A USDC balance is 6 decimals, so 1 USDC is `1_000_000n`, and the whole
 * arithmetic from here to a `uint256` is integer arithmetic.
 *
 * `bigint` rather than `number` is not a stylistic choice. 18 decimals of a
 * token is 1e18, which is larger than `Number.MAX_SAFE_INTEGER` (~9e15), so a
 * `number` silently loses the low digits of a wei — and a bond contract that
 * pays out on a rounded balance is a contract that pays out the wrong amount.
 */
export type TokenAmount = bigint;

/** USDC has 6 decimals, which is what the settlement contracts hold. */
export const USDC_DECIMALS = 6;

/** USD has 2 decimals. */
export const USD_DECIMALS = 2;

/** Largest amount we will accept, to bound a single attestation. */
export const MAX_TOKEN_AMOUNT = 10n ** 30n;

export function usdc(major: number, minor?: number): TokenAmount {
  if (!Number.isSafeInteger(major) || major < 0) {
    throw new ValidationError("A USDC amount needs a non-negative whole part", {
      received: String(major),
    });
  }
  const fractional = minor ?? 0;
  if (!Number.isSafeInteger(fractional) || fractional < 0) {
    throw new ValidationError("A USDC amount needs a non-negative fractional part", {
      received: String(fractional),
    });
  }
  return BigInt(major) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fractional);
}

/** Format a token amount for a human, with the token's own precision. */
export function formatTokenAmount(amount: TokenAmount, decimals: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new ValidationError("Token decimals must be a non-negative integer", {
      received: String(decimals),
    });
  }
  const negative = amount < 0n;
  const magnitude = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = magnitude / divisor;
  const fraction = decimals === 0 ? "" : `.${String(magnitude % divisor).padStart(decimals, "0")}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** A 32-byte value, lowercase hex with a `0x` prefix. */
export type Hex32 = `0x${string}`;

const HEX32_PATTERN = /^0x[0-9a-f]{64}$/;

export function isHex32(value: unknown): value is Hex32 {
  return typeof value === "string" && HEX32_PATTERN.test(value);
}

export function assertHex32(value: unknown, field: string): Hex32 {
  if (!isHex32(value)) {
    throw new ValidationError(`${field} must be 32 bytes of lowercase hex`, {
      received: String(value),
    });
  }
  return value;
}

/** A 20-byte EVM address, lowercase hex with a `0x` prefix. */
export type Address = `0x${string}`;

const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

/**
 * A 20-byte EVM address in lowercase.
 *
 * A contract's own addresses are compared with `==` in Solidity, and Solidity
 * compares hex literals as case-sensitive strings unless they are written in a
 * form it treats as a number. Normalising to lowercase on the way in removes
 * that class of mismatch entirely, so a bondholder pasting a checksummed address
 * and a keeper passing the same address programmatically cannot disagree about
 * whether it is the same account.
 */
export function isAddress(value: unknown): value is Address {
  return typeof value === "string" && ADDRESS_PATTERN.test(value);
}

export function assertAddress(value: unknown, field: string): Address {
  if (!isAddress(value)) {
    throw new ValidationError(`${field} must be a 20-byte lowercase hex address`, {
      received: String(value),
    });
  }
  return value;
}

/** Normalise a checksummed or uppercase address to the lowercase form. */
export function normalizeAddress(value: string): Address {
  const trimmed = value.trim().toLowerCase();
  if (!isAddress(trimmed)) {
    throw new ValidationError("Not a valid EVM address", { received: value });
  }
  return trimmed;
}

/**
 * An EIP-191 signature, lowercase hex with a `0x` prefix.
 *
 * A distinct type from {@link Hex32} on purpose, because a signature is 65
 * bytes and reusing the 32-byte type for it is not a shortcut — it makes
 * `assertHex32` reject every real signature, or, worse, makes it look correct
 * until a 65-byte value is passed and throws deep inside a signing path. The
 * shape is `r (32) || s (32) || v (1)`, which is what `ecrecover` consumes.
 */
export type Signature = `0x${string}`;

const SIGNATURE_PATTERN = /^0x[0-9a-f]{130}$/;

export function isSignature(value: unknown): value is Signature {
  return typeof value === "string" && SIGNATURE_PATTERN.test(value);
}

export function assertSignature(value: unknown, field: string): Signature {
  if (!isSignature(value)) {
    throw new ValidationError(`${field} must be a 65-byte lowercase hex signature`, {
      received: String(value),
    });
  }
  return value;
}

/** Normalise a checksummed or uppercase signature to the lowercase form. */
export function normalizeSignature(value: string): Signature {
  const trimmed = value.trim().toLowerCase();
  if (!isSignature(trimmed)) {
    throw new ValidationError("Not a valid EIP-191 signature", { received: value });
  }
  return trimmed;
}
