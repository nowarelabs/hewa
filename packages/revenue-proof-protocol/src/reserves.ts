import { ValidationError } from "@hewa/errors";
import {
  assertTokenAmount,
  dayKeyOf,
  type Address,
  type DayKey,
  type ReservesReport,
  type TokenAmount,
} from "@hewa/blockchain-types";
import {
  commitToRevenue,
  hashLeaf,
  pathFor,
  verify,
  type PaymentProof,
  type RevenueCommitment,
  type RevenueLeaf,
} from "./merkle.ts";
import {
  isSignedBy,
  signAttestation,
  type AttestationDomain,
  type AttestationSigner,
} from "./attest.ts";
import type { Attestation } from "@hewa/blockchain-types";

/**
 * The mismatch a proof of reserves is looking for.
 *
 * This is the check that actually catches a dishonest operator, and it is worth
 * being precise about why. A signature proves the figure came from us. It says
 * nothing about whether the figure is true, because we could sign anything. A
 * comparison between the signed on-chain total and the internal books catches
 * the case that matters — internal books quietly diverging from what was
 * published — and it only works if the two are computed by different code paths
 * from different sources. A check that reads the same table twice proves nothing.
 */
export interface ReservesCheck {
  readonly city: string;
  readonly month: number;
  /** Total from the internal ledger, in USDC base units. */
  readonly internalTotal: TokenAmount;
  /** Sum of the on-chain daily attestations for the month. */
  readonly onChainTotal: TokenAmount;
  /** What the internal books say the day should have been. */
  readonly expectedDays: number;
  /** How many days of the month carry an attestation. */
  readonly attestedDays: number;
}

/** Outcome of a reserves check. */
export type ReservesVerdict =
  | { readonly ok: true; readonly report: ReservesReport }
  | {
      readonly ok: false;
      readonly reasons: readonly string[];
      readonly difference: TokenAmount;
    };

/**
 * A month is a `YYYYMM` integer, matching `uint32` on chain.
 *
 * Distinct from a `DayKey` so a month can never be passed where a day belongs.
 * A month of revenue and a day of revenue are the same shape and a different
 * scale, and mixing them up understates a payout by a factor of thirty.
 */
export function assertMonth(value: unknown): number {
  // 200001 to 999912: a six-digit `YYYYMM`. The first two digits of the year
  // only, because a wider bound would admit a `YYYYMMDD` day key — 20260928
  // passes a `20000101..99991231` range and is a day, not a month.
  if (typeof value !== "number" || !Number.isInteger(value) || value < 200_001 || value > 999_912) {
    throw new ValidationError("A month must be a YYYYMM integer", { received: String(value) });
  }
  const month = value % 100;
  if (month < 1 || month > 12)
    throw new ValidationError("A month must be a YYYYMM integer", { received: String(value) });
  return value;
}

/** Every day key in a `YYYYMM` month, as `YYYYMMDD`. */
export function daysInMonth(month: number): DayKey[] {
  const checked = assertMonth(month);
  const year = Math.floor(checked / 100);
  const monthPart = checked % 100;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = lengths[monthPart - 1] ?? 0;
  return Array.from({ length: days }, (_, i) => checked * 100 + (i + 1));
}

/** Sum the on-chain revenue over a set of days. */
export function sumAttestedRevenue(attestations: readonly Attestation[]): TokenAmount {
  return attestations.reduce((total, attestation) => total + attestation.record.revenue, 0n);
}

/**
 * Reject a month where a day is missing.
 *
 * A partial month is not a smaller number, it is a wrong one. If only twenty
 * days posted and the payout used the sum, bondholders would receive a
 * proportion of what they were owed with no signal that anything was absent.
 */
export function checkCoverage(check: ReservesCheck): readonly string[] {
  const reasons: string[] = [];
  if (check.attestedDays !== check.expectedDays) {
    reasons.push(`only ${check.attestedDays} of ${check.expectedDays} days carry an attestation`);
  }
  return reasons;
}

/** Compare the internal books against what was published. */
export function checkTotals(check: ReservesCheck): readonly string[] {
  if (check.internalTotal !== check.onChainTotal) {
    return [
      `internal ${check.internalTotal.toString()} does not match on-chain ${check.onChainTotal.toString()}`,
    ];
  }
  return [];
}

/**
 * The monthly report, or the reasons it cannot be issued.
 *
 * The on-chain total is summed from `attestations`, not read off `check`. Taking
 * it as an input would let the figure that gets published be a different number
 * from the daily attestations it claims to summarise, which is the exact
 * disagreement this report exists to detect. `check.onChainTotal` is therefore
 * treated as a *claim* about the attestations and checked against them, so a
 * caller that has miscounted gets a reason rather than a clean report.
 *
 * `operatingCosts` are taken as given rather than derived: costs are the one
 * number an operator controls without a counterparty receipt behind them, which
 * is why the report names its source and why a bondholder reads the audit
 * attestation before the total.
 */
export function buildReservesReport(
  check: ReservesCheck,
  attestations: readonly Attestation[],
  operatingCosts: TokenAmount,
  merkleRoot: `0x${string}`,
  documentHash: `0x${string}`,
): ReservesVerdict {
  const attestedTotal = sumAttestedRevenue(attestations);
  const reconciled: ReservesCheck = { ...check, onChainTotal: attestedTotal };
  const reasons = [
    ...checkCoverage(check),
    ...checkTotals(reconciled),
    // The stated total and the daily attestations have to agree too, or the
    // report is a sum of one set of numbers under a heading derived from another.
    ...(check.onChainTotal === attestedTotal
      ? []
      : [
          `stated on-chain total ${check.onChainTotal.toString()} does not match the ${attestations.length} daily attestations, which sum to ${attestedTotal.toString()}`,
        ]),
  ];
  if (reasons.length > 0) {
    return {
      ok: false,
      reasons,
      // Signed, so a reader can tell which way the books are wrong: negative
      // means the internal books fall short of what was published, positive
      // means they overstate it. An absolute value would hide the difference
      // between "we recorded less than we claimed" and "we recorded more".
      difference: check.internalTotal - attestedTotal,
    };
  }
  const net = attestedTotal - assertTokenAmount(operatingCosts, "operatingCosts");
  return {
    ok: true,
    report: {
      city: check.city,
      month: check.month,
      grossRevenue: attestedTotal,
      operatingCosts,
      // Floored at zero. A negative net revenue would underflow the payout
      // calculation on chain, where there is no way to represent it.
      netRevenue: net > 0n ? net : 0n,
      onChainRevenue: attestedTotal,
      merkleRoot,
      documentHash,
    },
  };
}

/** Everything needed to publish one day's attestation. */
export interface AttestationJob {
  readonly city: string;
  readonly day: DayKey;
  readonly leaves: readonly RevenueLeaf[];
}

/**
 * Commit, sign, and hand back one day's attestation.
 *
 * The total published is the sum of the committed leaves rather than a figure
 * passed alongside them. Taking the total as an input would let the signed
 * number and the committed payments disagree, and the Merkle root would then be
 * evidence for a different sum than the one on the invoice.
 */
export async function attestDay(
  signer: AttestationSigner,
  domain: AttestationDomain,
  job: AttestationJob,
): Promise<{ readonly attestation: Attestation; readonly commitment: RevenueCommitment }> {
  const commitment = commitToRevenue(job.city, job.day, job.leaves, hashLeaf);
  const record = {
    city: job.city,
    day: job.day,
    revenue: commitment.total,
    ispCount: commitment.leafCount,
  };
  return {
    attestation: await signAttestation(signer, domain, record, commitment.root),
    commitment,
  };
}

/** Confirm an attestation is ours before it goes near a transaction. */
export function assertOurs(
  attestation: Attestation,
  domain: AttestationDomain,
  expected: Address,
): void {
  if (!isSignedBy(attestation, domain, expected)) {
    throw new ValidationError("Attestation was not signed by the expected key", {
      signer: attestation.signature,
    });
  }
}

/** One payment's proof, for a bondholder who has been asked about one ISP. */
export function paymentProof(commitment: RevenueCommitment, ispId: string): PaymentProof {
  const index = commitment.leaves.findIndex((leaf) => leaf.ispId === ispId);
  if (index < 0) {
    // Naming the absence is the point: a request for an ISP who is not in the
    // day has to be answerable without inspecting the other leaves.
    throw new ValidationError("No payment for that ISP on that day", {
      ispId,
      day: String(commitment.day),
    });
  }
  const leaf = commitment.leaves[index] as RevenueLeaf;
  return {
    ispId,
    amount: leaf.amount,
    city: commitment.city,
    day: commitment.day,
    merkleRoot: commitment.root,
    path: pathFor(commitment.leaves, index, commitment.day, hashLeaf),
  };
}

export { verify };

/** The day a settlement run should attest: yesterday, in UTC. */
export function yesterday(now: Date): DayKey {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dayKeyOf(new Date(startOfToday - 86_400_000));
}
