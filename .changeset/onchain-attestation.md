---
"@hewa/blockchain-types": minor
"@hewa/revenue-proof-protocol": minor
"@hewa/crypto": minor
"@hewa/marketplace-types": minor
"@hewa/billing-domain": minor
"@hewa/proto": minor
---

Add the on-chain revenue attestation layer, and express SLA math exactly.

`@hewa/blockchain-types` and `@hewa/revenue-proof-protocol` are new. They commit a
day's ISP payments to a salted, domain-separated Merkle root, sign the day's total
and that root together as an EIP-712 envelope bound to a chain and a verifying
contract, and sum a month's attestations back to a figure that has to match the
internal books exactly.

Six fixes worth calling out, each of which failed before:

- An EIP-191 signature was typed and asserted as a 32-byte hash, so it rejected
  every real signature. `Hex32` and `Signature` are now separate types with
  separate assertions, because one predicate for both either rejects every
  signature or accepts a bare digest as one.
- `signDigest` and `recoverDigestSigner` signed the digest as a hex _string_.
  Ethers treats a `string` argument to `signMessage` as UTF-8 text, so the
  signature covered 66 characters where a contract's
  `ECDSA.toEthSignedMessageHash(bytes32)` covers 32. Both now sign the raw 32
  bytes.
- `bondholderAccrual` floored the bond's _aggregate_ interest before pro-rating
  it, so every holder was short by up to one base unit and a small bond's payout
  collapsed to zero. It now multiplies every factor and divides once, which is
  also the only form a contract can reproduce — Solidity truncates at each `/`.
- `checksumAddress` lowercased before validating, so a mistyped mixed-case address
  was silently repaired into a valid-looking different one and a transfer went
  somewhere nobody intended. Mixed case is now validated against its checksum.
- An availability target is now an integer in basis points and a credit is an
  exact `numerator / denominator`, replacing the float fields and the `1e-9`
  epsilon that papered over `(1 - 0.9) * 100` being `9.999999999999998`.
  Rounding happens once, half away from zero, and the credit is capped so it can
  never reduce a bill below zero.
- `assertMonth` bounded a `YYYYMM` month with 8-digit day-key limits, so every
  month it was given was rejected.
