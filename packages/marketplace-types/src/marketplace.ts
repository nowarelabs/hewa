import { ValidationError } from "@hewa/errors";
import type { Money } from "./money.ts";
import type { SlaCommitment } from "./sla.ts";

/**
 * Bandwidth an operator has put up for sale.
 *
 * `committed` is the floor the buyer pays for whether or not it is used, and
 * `burst` is the headroom above it they may use and pay overage for.
 */
export interface Bandwidth {
  readonly id: string;
  /** Operator that owns the capacity. */
  readonly supplierId: string;
  /** Guaranteed Mbps, always billed. */
  readonly committedMbps: number;
  /** Peak Mbps available above the commitment. */
  readonly burstMbps: number;
  readonly location: string;
  /** Price per Mbps per month, in `price.currency`. */
  readonly price: Money;
  readonly sla: SlaCommitment;
}

export function assertBandwidth(value: Bandwidth): Bandwidth {
  assertNonNegative(value.committedMbps, "committedMbps", value.id);
  assertNonNegative(value.burstMbps, "burstMbps", value.id);
  if (value.burstMbps < value.committedMbps) {
    throw new ValidationError("Burst capacity cannot be below the commitment", {
      id: value.id,
      committedMbps: value.committedMbps,
      burstMbps: value.burstMbps,
    });
  }
  if (value.price.amountMinor < 0) {
    throw new ValidationError("Bandwidth price cannot be negative", {
      id: value.id,
      amountMinor: value.price.amountMinor,
    });
  }
  if (value.location.trim() === "") {
    throw new ValidationError("Bandwidth must have a location", { id: value.id });
  }
  return value;
}

/**
 * The billing systems an ISP might already run.
 *
 * Most large ISPs bill through one of the two vendor suites, and the rest have
 * something bespoke that only speaks webhooks. Which one it is decides how
 * usage reaches their team.
 */
export const BSS_OSS_SYSTEMS = ["Amdocs", "Openet", "Custom"] as const;

export type BssOssSystem = (typeof BSS_OSS_SYSTEMS)[number];

const BSS_OSS_SET: ReadonlySet<string> = new Set(BSS_OSS_SYSTEMS);

export function isBssOssSystem(value: unknown): value is BssOssSystem {
  return typeof value === "string" && BSS_OSS_SET.has(value);
}

/** Where an ISP wants its payouts sent. */
export interface BankAccount {
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly currency: string;
}

/**
 * An ISP that buys bandwidth.
 *
 * Named `Isp` rather than `ISP` to match the naming convention the rest of the
 * codebase already uses; the abbreviation is spelled out in prose.
 */
export interface Isp {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly bankDetails: BankAccount;
  /** EVM address for stablecoin payouts, when the ISP has one. */
  readonly walletAddress: string | null;
  readonly bssOssSystem: BssOssSystem;
  /** Credential the BSS/OSS sync authenticates with. */
  readonly bssOssApiKey: string;
}

/**
 * A bank account holds a plain string, an ISP account is a first-class record:
 * that asymmetry is the reason this file exists.
 */
export function assertIsp(value: Isp): Isp {
  if (value.id.trim() === "") {
    throw new ValidationError("ISP must have an id", { received: value.id });
  }
  if (value.name.trim() === "") {
    throw new ValidationError("ISP must have a name", { id: value.id });
  }
  if (!isBssOssSystem(value.bssOssSystem)) {
    throw new ValidationError("Unsupported BSS/OSS system", {
      id: value.id,
      received: String(value.bssOssSystem),
      supported: [...BSS_OSS_SYSTEMS],
    });
  }
  return value;
}

/** True when the ISP can be paid in stablecoin. */
export function supportsStablecoinPayout(isp: Isp): boolean {
  return isp.walletAddress !== null && isp.walletAddress.trim() !== "";
}

/** Mbps still unsold on a listing. */
export function availableCapacity(capacity: {
  readonly totalMbps: number;
  readonly soldMbps: number;
}): number {
  return capacity.totalMbps - capacity.soldMbps;
}

/** True when a listing can take another `requestedMbps` without overcommitting. */
export function hasCapacityFor(
  capacity: { readonly totalMbps: number; readonly soldMbps: number },
  requestedMbps: number,
): boolean {
  assertNonNegative(requestedMbps, "requestedMbps", "capacity");
  return availableCapacity(capacity) >= requestedMbps;
}

/**
 * @param value
 * @param field
 * @param owner
 */
function assertNonNegative(value: number, field: string, owner: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} cannot be negative`, { owner, received: String(value) });
  }
}
