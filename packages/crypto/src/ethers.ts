import { getAddress, isAddress } from "ethers";
import { ValidationError } from "@hewa/errors";
import { normalizeAddress } from "./stablecoin.ts";

/**
 * Ethers re-exports, so consumers of this package never take a direct
 * `ethers` dependency and cannot end up with two copies in a bundle.
 */
export { getAddress, isAddress };

/**
 * Validate an address and return it EIP-55 checksummed.
 *
 * A lowercase address is accepted and returned checksummed, because that is a
 * deliberate choice. A mixed-case address whose checksum is wrong is rejected:
 * that combination means a transcription error, and a transfer sent to a
 * mistyped address is not recoverable.
 */
export function checksumAddress(address: string): string {
  const normalized = normalizeAddress(address);
  try {
    return getAddress(normalized);
  } catch (cause) {
    throw new ValidationError("Address fails its EIP-55 checksum", {
      received: address,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
