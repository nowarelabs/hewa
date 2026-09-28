import { ValidationError } from "@hewa/errors";
import {
  assertHex32,
  assertSignature,
  assertTokenAmount,
  normalizeAddress,
  type Address,
  type Attestation,
  type ChainId,
  type DailyRevenueRecord,
  type DayKey,
  type Hex32,
} from "@hewa/blockchain-types";
import { recoverDigestSigner, TypedDataEncoder, type TypedDataField } from "@hewa/crypto";

/**
 * The bytes a signature actually covers.
 *
 * EIP-712, because the alternative is worse. A plain `abi.encode` digest is an
 * opaque 32 bytes: nobody can read it, a bondholder cannot tell what they are
 * verifying without a decoder, and there is no way to add a field to an
 * attestation later without invalidating every signature already on chain.
 * EIP-712 is a structured, typed, human-readable envelope that a wallet can
 * render before signing and a verifier can check field by field.
 */

/** Chain-scoped domain the attestations are signed under. */
export interface AttestationDomain {
  readonly name: string;
  readonly version: string;
  readonly chainId: ChainId;
  readonly verifyingContract: Address;
}

/** The types EIP-712 hashes, matching `RevenueAttestation.sol`. */
// Typed as what `TypedDataEncoder.hash` takes, rather than `as const`: the
// encoder's own type is the contract, and a `readonly` array is not assignable
// to it. Nothing mutates this — it is a module constant — but it is written so a
// field added here cannot be silently dropped by a type error either.
export const ATTESTATION_TYPES: Record<string, TypedDataField[]> = {
  DailyRevenue: [
    { name: "city", type: "string" },
    { name: "day", type: "uint32" },
    { name: "revenue", type: "uint256" },
    { name: "ispCount", type: "uint32" },
    { name: "merkleRoot", type: "bytes32" },
  ],
};

/** The domain separator, as a contract computes it on deployment. */
export function domainSeparator(domain: AttestationDomain): Hex32 {
  return assertHex32(
    TypedDataEncoder.hashDomain({
      name: domain.name,
      version: domain.version,
      chainId: Number(domain.chainId),
      verifyingContract: domain.verifyingContract,
    }),
    "domain separator",
  );
}

/**
 * The digest a signature covers.
 *
 * Every field is in here, including the Merkle root. Leaving the root out would
 * let us sign a day's *total* and attach a different root afterwards, so a
 * signature would say nothing about which payments the total came from.
 *
 * The hash is delegated to `TypedDataEncoder` rather than assembled by hand. A
 * hand-written EIP-712 encoder is a second implementation of a specification
 * whose only correctness criterion is agreeing with the contract's; being wrong
 * in it produces signatures that recover to nobody on chain, which is a failure
 * with no local symptom until the transaction is already sent.
 */
export function attestationDigest(
  domain: AttestationDomain,
  record: DailyRevenueRecord,
  merkleRoot: Hex32,
): Hex32 {
  return assertHex32(
    TypedDataEncoder.hash(
      {
        name: domain.name,
        version: domain.version,
        chainId: Number(domain.chainId),
        verifyingContract: domain.verifyingContract,
      },
      ATTESTATION_TYPES,
      {
        city: record.city,
        day: record.day,
        revenue: record.revenue,
        ispCount: record.ispCount,
        merkleRoot: assertHex32(merkleRoot, "merkleRoot"),
      },
    ),
    "attestation digest",
  );
}

/** What a signer is handed, and what comes back. */
export interface AttestationSigner {
  /** The account signatures are checked against. */
  readonly address: Address;
  /**
   * Sign a 32-byte digest.
   *
   * Behind an interface so the key can live in an HSM or a KMS. A signer that
   * took a private key would put a signing credential in a process that also
   * parses vendor HTTP responses, which is not a boundary worth having.
   */
  sign(digest: Hex32): Promise<string>;
}

/** Build the record an attestation commits to. */
export function dailyRecord(
  city: string,
  day: DayKey,
  revenue: bigint,
  ispCount: number,
): DailyRevenueRecord {
  if (city.trim() === "") {
    throw new ValidationError("An attestation needs a city", {});
  }
  if (!Number.isInteger(ispCount) || ispCount < 0) {
    throw new ValidationError("An ISP count must be a non-negative integer", {
      received: String(ispCount),
    });
  }
  return {
    city,
    day,
    revenue: assertTokenAmount(revenue, "revenue"),
    ispCount,
  };
}

/** Sign a day's revenue, producing what the contract's `recordDailyRevenue` takes. */
export async function signAttestation(
  signer: AttestationSigner,
  domain: AttestationDomain,
  record: DailyRevenueRecord,
  merkleRoot: Hex32,
): Promise<Attestation> {
  const digest = attestationDigest(domain, record, merkleRoot);
  const signature = await signer.sign(digest);
  return { record, merkleRoot, signature: assertSignature(signature, "signature") };
}

/**
 * Check an attestation.
 *
 * Returns the recovered signer rather than a boolean, because "invalid" and
 * "signed by someone else" need different handling: a bad signature is an
 * incident, a different signer is a deployment mistake. A boolean would collapse
 * the two.
 */
export function verifyAttestation(
  attestation: Attestation,
  domain: AttestationDomain,
): { readonly signer: Address; readonly digest: Hex32 } {
  const digest = attestationDigest(domain, attestation.record, attestation.merkleRoot);
  const signer = recoverDigestSigner(digest, attestation.signature);
  return { signer: normalizeAddress(signer), digest };
}

/** True when the attestation was signed by the expected key. */
export function isSignedBy(
  attestation: Attestation,
  domain: AttestationDomain,
  expected: Address,
): boolean {
  try {
    return verifyAttestation(attestation, domain).signer === normalizeAddress(expected);
  } catch {
    // A malformed signature is a failed check, not an exception for a verifier
    // to handle: a bondholder pasting arbitrary input should see "not verified".
    return false;
  }
}
