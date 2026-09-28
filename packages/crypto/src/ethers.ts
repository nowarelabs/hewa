import {
  AbiCoder,
  TypedDataEncoder,
  getAddress,
  getBytes,
  isAddress,
  keccak256,
  solidityPackedKeccak256,
  verifyMessage,
  type Signer,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";
import { ValidationError } from "@hewa/errors";
import { normalizeAddress } from "./stablecoin.ts";

/**
 * Ethers re-exports, so consumers of this package never take a direct
 * `ethers` dependency and cannot end up with two copies in a bundle.
 */
export {
  AbiCoder,
  TypedDataEncoder,
  getAddress,
  isAddress,
  keccak256,
  solidityPackedKeccak256,
  verifyMessage,
};
export type { Signer, TypedDataDomain, TypedDataField };

/**
 * Validate an address and return it EIP-55 checksummed.
 *
 * An all-lowercase or all-uppercase address is accepted and returned
 * checksummed: that is a deliberate choice, since an all-lowercase address
 * carries no checksum information and rejecting it would reject a legitimate
 * input. A *mixed-case* address is validated against its checksum, because
 * mixed case is a claim about the address and a wrong claim is a transcription
 * error. A transfer sent to a mistyped address is not recoverable.
 */
export function checksumAddress(address: string): string {
  const body = address.startsWith("0x") || address.startsWith("0X") ? address.slice(2) : address;
  // Preserve the original case when deciding. Normalizing first and then calling
  // `getAddress` would defeat the whole check: the lowercased form is always
  // valid, so a mistyped mixed-case address would be silently repaired into a
  // valid-looking different one, which is the failure this function exists to
  // prevent.
  const hasMixedCase = body !== body.toLowerCase() && body !== body.toUpperCase();
  const candidate = hasMixedCase ? address : normalizeAddress(address);
  try {
    return getAddress(candidate);
  } catch (cause) {
    throw new ValidationError("Address fails its EIP-55 checksum", {
      received: address,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

const coder = AbiCoder.defaultAbiCoder();

/** ABI-encode a set of values against a set of Solidity type strings. */
export function encodeAbi(types: readonly string[], values: readonly unknown[]): string {
  return coder.encode(types, values);
}

/** ABI-decode a payload against a set of Solidity type strings. */
export function decodeAbi(types: readonly string[], data: string): readonly unknown[] {
  return coder.decode(types, data);
}

/**
 * Sign a 32-byte digest with the EIP-191 personal-message prefix.
 *
 * Signing a raw digest is *not* what a contract's `ecrecover` expects. A
 * contract that recovers a raw digest is vulnerable to a signature being
 * replayed as a valid signature on any other contract that reuses the digest,
 * because a raw ECDSA signature carries no commitment to which contract or
 * which chain produced it. The EIP-191 prefix binds all of that, and this
 * wrapper exists so no caller has to remember that.
 *
 * The key stays behind `Signer`, so an HSM or KMS can be passed in instead of a
 * private key. Nothing in this repository holds a key.
 */
export async function signDigest(signer: Signer, digest: string): Promise<string> {
  // `getBytes`, not the string. Ethers treats a `string` argument to
  // `signMessage` as UTF-8 text, so signing the hex literal would cover the 66
  // characters `0xfdb0...` rather than the 32 bytes the digest names. A contract
  // calling `ECDSA.toEthSignedMessageHash(bytes32)` hashes the raw bytes, so the
  // string form produces a signature that recovers to nobody on chain. It fails
  // closed, which is the safe direction, but it fails in production.
  return signer.signMessage(getBytes(digest));
}

/**
 * Recover the signer of a digest signed by {@link signDigest}.
 *
 * Throws rather than returning false for a malformed signature, because a caller
 * that treats "unparseable" and "wrong signer" as the same thing is a caller
 * that will report a valid attestation as forged.
 */
export function recoverDigestSigner(digest: string, signature: string): string {
  try {
    // Symmetric with `signDigest`: recover over the raw 32 bytes, so a verifier
    // here and an `ecrecover` in a contract agree.
    return normalizeAddress(verifyMessage(getBytes(digest), signature));
  } catch (cause) {
    throw new ValidationError("Signature does not recover to a signer", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
