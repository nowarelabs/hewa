import { describe, expect, test } from "vite-plus/test";
import {
  Wallet,
  getAddress,
  getBytes,
  hashMessage,
  solidityPackedKeccak256,
  verifyMessage,
} from "ethers";
import {
  checksumAddress,
  decodeAbi,
  encodeAbi,
  keccak256,
  recoverDigestSigner,
  signDigest,
} from "../src/index.ts";

const LOWER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const CHECKSUMMED = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MISTYPED = "0xf39fd6e51aad88F6F4ce6aB8827279cffFb92265";

const digest = keccak256(encodeAbi(["string", "uint256"], ["johannesburg", 20260928]));

describe("checksumAddress", () => {
  test("accepts a lowercase address and returns it checksummed", () => {
    // An all-lowercase address carries no checksum claim, so rejecting it would
    // reject a legitimate input.
    expect(checksumAddress(LOWER)).toBe(CHECKSUMMED);
  });

  test("accepts an already-checksummed address unchanged", () => {
    expect(checksumAddress(CHECKSUMMED)).toBe(CHECKSUMMED);
  });

  test("rejects a mistyped mixed-case address", () => {
    // The whole point of the check. Normalising before validating would quietly
    // repair this into a valid-looking different address and the transfer would
    // go somewhere nobody intended.
    expect(() => checksumAddress(MISTYPED)).toThrow(/EIP-55 checksum/);
  });

  test("accepts the mistyped address once it is all lowercase", () => {
    // Documenting the boundary of the rule: the checksum only exists in the
    // mixed case, so lowercasing a mistyped address discards the claim and the
    // address is accepted. That is the correct behaviour for a checksum that
    // asserts something about the value, and why the mixed-case form is the one
    // that must be rejected.
    expect(checksumAddress(MISTYPED.toLowerCase())).toBe(getAddress(MISTYPED.toLowerCase()));
  });

  test("rejects a truncated address", () => {
    // A malformed length is caught by the address pattern, before EIP-55 is
    // even relevant; both messages describe an address this will not accept.
    expect(() => checksumAddress(LOWER.slice(0, -1))).toThrow(/EIP-55 checksum|valid EVM address/);
  });
});

describe("signing a digest", () => {
  test("signs the raw 32 bytes, not the hex string", async () => {
    // Ethers treats a `string` argument to `signMessage` as UTF-8 text. Signing
    // the hex literal would cover 66 characters instead of 32 bytes and produce
    // a signature that recovers to nobody against a contract calling
    // `ECDSA.toEthSignedMessageHash(bytes32)`.
    const wallet = Wallet.createRandom();
    const signature = await signDigest(wallet, digest);

    const fromRawBytes = verifyMessage(getBytes(digest), signature);
    const fromHexText = verifyMessage(digest, signature);

    expect(fromRawBytes).toBe(wallet.address);
    expect(fromHexText).not.toBe(wallet.address);
  });

  test("matches the digest a contract's toEthSignedMessageHash would produce", async () => {
    // The contract does `keccak256("\x19Ethereum Signed Message:\n32" || digest)`.
    // `signMessage` over raw bytes computes exactly that.
    // `solidityPackedKeccak256` already applies keccak256 to the packed
    // encoding, so there is no second hash here.
    const expected = solidityPackedKeccak256(
      ["string", "bytes32"],
      ["\x19Ethereum Signed Message:\n32", digest],
    );
    expect(hashMessage(getBytes(digest))).toBe(expected);
  });

  test("recovers the signer that produced it", async () => {
    const wallet = Wallet.createRandom();
    const signature = await signDigest(wallet, digest);
    expect(recoverDigestSigner(digest, signature)).toBe(wallet.address.toLowerCase());
  });

  test("recovers a different signer for a different digest", async () => {
    // This is the property that makes the EIP-191 prefix worth having: a
    // signature covers what was signed, so it cannot be moved onto another fact.
    const wallet = Wallet.createRandom();
    const signature = await signDigest(wallet, digest);
    const other = keccak256(encodeAbi(["string"], ["kampala"]));
    expect(recoverDigestSigner(other, signature)).not.toBe(wallet.address.toLowerCase());
  });

  test("refuses to recover from a malformed signature", () => {
    // Throwing rather than returning false: a caller that treats "unparseable"
    // and "wrong signer" alike would report a valid attestation as forged.
    expect(() => recoverDigestSigner(digest, "0xdeadbeef")).toThrow(/does not recover/);
  });
});

describe("ABI helpers", () => {
  test("round-trips a tuple", () => {
    const types = ["string", "uint256", "bytes32"] as const;
    const values = ["johannesburg", 6_700_000_000n, digest];
    expect(decodeAbi(types, encodeAbi(types, values))).toEqual(values);
  });

  test("encodes an address as 20 bytes, not as text", () => {
    // A `string` would encode to its own length; a mis-typed ABI here silently
    // changes the digest, which is why these tests exist.
    const encoded = encodeAbi(["address"], [LOWER]);
    expect(encoded.length).toBe(2 + 64);
  });
});
