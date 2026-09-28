import { describe, expect, test } from "vite-plus/test";
// Dev-only: a test needs a real key. Production signing is the injected
// `AttestationSigner`, backed by an HSM.
import { Wallet } from "ethers";
import {
  assertSignature,
  isSignature,
  normalizeAddress,
  usdc,
  type DayKey,
} from "@hewa/blockchain-types";
import { checksumAddress, signDigest, TypedDataEncoder, type Signer } from "@hewa/crypto";
import {
  ATTESTATION_TYPES,
  assertOurs,
  attestDay,
  attestationDigest,
  dailyRecord,
  domainSeparator,
  isSignedBy,
  paymentProof,
  signAttestation,
  verify,
  verifyAttestation,
  type AttestationDomain,
  type AttestationSigner,
  type RevenueLeaf,
} from "../src/index.ts";

const day: DayKey = 20260928;
const CONTRACT = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const OTHER_CONTRACT = "0x0000000000000000000000000000000000000009";

/** An `ethers` wallet address as the on-chain vocabulary spells it. */
const owner = (wallet: TestSigner) => normalizeAddress(wallet.address);

/**
 * The signing surface a test needs.
 *
 * Typed as the `Signer` that `signDigest` takes, so the test signs through
 * exactly the path an HSM adapter would. A hand-rolled narrower interface here
 * would compile while proving nothing about that path.
 */
type TestSigner = Signer & { readonly address: string };

const domain: AttestationDomain = {
  name: "Hewa Revenue Attestation",
  version: "1",
  chainId: 137,
  verifyingContract: CONTRACT,
};

const leaves: RevenueLeaf[] = [
  { ispId: "isp_alpha", amount: usdc(2_000) },
  { ispId: "isp_bravo", amount: usdc(1_500) },
];

/**
 * A signer backed by a throwaway key.
 *
 * The key comes from `ethers` through this package's own re-export, so the test
 * signs through the same code path production does and takes no direct
 * dependency on `ethers`.
 */
function walletSigner(wallet: TestSigner): AttestationSigner {
  return {
    address: normalizeAddress(wallet.address),
    sign: (digest) => signDigest(wallet, digest),
  };
}

describe("EIP-712 domain", () => {
  // Pinned by `contracts/test/Attestation.t.sol`. These are the values a Solidity
  // `EIP712` computes for the same domain; if either side moves, an attestation
  // signed off chain stops recovering on chain and every published figure is
  // unverifiable at once.
  const VECTOR = {
    domainSeparator: "0x04f623c4255e7b8ea3b447c56b93d6d5838a7c9683c99374ce36906695d4cb99",
    digest: "0x2fdbe29f93b4cf5e1a1dd1a44261f1b66819e8aed19960d930dba26f835ac0b1",
  };

  test("the domain separator matches the pinned contract vector", () => {
    expect(domainSeparator(domain)).toBe(VECTOR.domainSeparator);
  });

  test("the digest matches the pinned contract vector", () => {
    const root = `0x${"ab".repeat(32)}` as const;
    expect(attestationDigest(domain, dailyRecord("johannesburg", day, usdc(3_500), 2), root)).toBe(
      VECTOR.digest,
    );
  });

  test("binds the contract and the chain", () => {
    // Without the contract in the domain, one deployment's signature authorises
    // another deployment's revenue. Without the chain, the same signature is
    // valid on every chain the key has ever touched.
    expect(domainSeparator({ ...domain, chainId: 1 })).not.toBe(VECTOR.domainSeparator);
    expect(domainSeparator({ ...domain, verifyingContract: OTHER_CONTRACT })).not.toBe(
      VECTOR.domainSeparator,
    );
    expect(domainSeparator({ ...domain, version: "2" })).not.toBe(VECTOR.domainSeparator);
  });

  test("is a 32-byte hash", () => {
    expect(domainSeparator(domain)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("declares the struct it hashes, in the order a wallet renders it", () => {
    expect(ATTESTATION_TYPES.DailyRevenue.map((f) => `${f.name}:${f.type}`)).toEqual([
      "city:string",
      "day:uint32",
      "revenue:uint256",
      "ispCount:uint32",
      "merkleRoot:bytes32",
    ]);
    // The type string is hashed into the struct hash, so a reordering here is a
    // different digest and a silently unverifiable attestation.
    expect(TypedDataEncoder.from(ATTESTATION_TYPES).encodeType("DailyRevenue")).toBe(
      "DailyRevenue(string city,uint32 day,uint256 revenue,uint32 ispCount,bytes32 merkleRoot)",
    );
  });
});

describe("attestation digests", () => {
  const root = `0x${"ab".repeat(32)}` as const;
  const record = dailyRecord("johannesburg", day, usdc(3_500), 2);

  test("changes when the Merkle root changes", () => {
    // Signing the total and attaching a root afterwards would let a signature
    // vouch for a sum it never saw the itemisation of.
    const a = attestationDigest(domain, record, root);
    const b = attestationDigest(domain, record, `0x${"cd".repeat(32)}`);
    expect(b).not.toBe(a);
  });

  test("changes when the total changes", () => {
    expect(attestationDigest(domain, { ...record, revenue: usdc(3_501) }, root)).not.toBe(
      attestationDigest(domain, record, root),
    );
  });

  test("changes when the city changes", () => {
    expect(attestationDigest(domain, { ...record, city: "kampala" }, root)).not.toBe(
      attestationDigest(domain, record, root),
    );
  });

  test("changes when the day changes", () => {
    expect(attestationDigest(domain, { ...record, day: 20260929 }, root)).not.toBe(
      attestationDigest(domain, record, root),
    );
  });

  test("changes when the chain changes", () => {
    expect(attestationDigest({ ...domain, chainId: 1 }, record, root)).not.toBe(
      attestationDigest(domain, record, root),
    );
  });

  test("is a 32-byte hash", () => {
    expect(attestationDigest(domain, record, root)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("signing an attestation", () => {
  const root = `0x${"ab".repeat(32)}` as const;
  const record = dailyRecord("johannesburg", day, usdc(3_500), 2);

  test("produces a 65-byte signature, not a 32-byte digest", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    // A `Hex32` here would reject every real signature at runtime.
    expect(isSignature(attestation.signature)).toBe(true);
    expect(attestation.signature).toHaveLength(132);
  });

  test("recovers to the signer", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    const { signer, digest } = verifyAttestation(attestation, domain);
    expect(signer).toBe(normalizeAddress(wallet.address));
    expect(digest).toBe(attestationDigest(domain, record, root));
  });

  test("does not recover under a different contract", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    // The replay this prevents: the same signature presented to another
    // deployment, where it would authorise someone else's revenue.
    expect(
      isSignedBy(
        attestation,
        { ...domain, verifyingContract: "0x0000000000000000000000000000000000000009" },
        owner(wallet),
      ),
    ).toBe(false);
  });

  test("does not recover under a different chain", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    expect(isSignedBy(attestation, { ...domain, chainId: 1 }, owner(wallet))).toBe(false);
  });

  test("does not verify after the figure is edited", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    const inflated: typeof attestation = {
      ...attestation,
      record: { ...record, revenue: usdc(3_500_000) },
    };
    expect(isSignedBy(inflated, domain, owner(wallet))).toBe(false);
  });

  test("does not verify against a different key", async () => {
    const signer = Wallet.createRandom();
    const other = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(signer), domain, record, root);
    expect(isSignedBy(attestation, domain, owner(other))).toBe(false);
  });

  test("reports a malformed signature as unverified, not as an error", async () => {
    const wallet = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(wallet), domain, record, root);
    // A bondholder pasting arbitrary input should see "not verified", not a
    // stack trace, and "not verified" must not be confused with "forged".
    const truncated = { ...attestation, signature: "0xdeadbeef" } as typeof attestation;
    expect(isSignedBy(truncated, domain, owner(wallet))).toBe(false);
  });

  test("refuses to publish an attestation signed by anyone else", async () => {
    const signer = Wallet.createRandom();
    const other = Wallet.createRandom();
    const attestation = await signAttestation(walletSigner(signer), domain, record, root);
    expect(() => assertOurs(attestation, domain, owner(other))).toThrow(/not signed by/);
    expect(() => assertOurs(attestation, domain, owner(signer))).not.toThrow();
  });

  test("refuses a record with an empty city or a fractional ISP count", () => {
    expect(() => dailyRecord("  ", day, usdc(1), 1)).toThrow(/city/);
    expect(() => dailyRecord("johannesburg", day, usdc(1), 1.5)).toThrow(/integer/);
  });
});

describe("attesting a day", () => {
  test("signs the total it committed to, not a total passed alongside", async () => {
    const wallet = Wallet.createRandom();
    const { attestation, commitment } = await attestDay(walletSigner(wallet), domain, {
      city: "johannesburg",
      day,
      leaves,
    });
    expect(attestation.record.revenue).toBe(usdc(3_500));
    expect(attestation.record.ispCount).toBe(2);
    expect(attestation.merkleRoot).toBe(commitment.root);
    expect(isSignedBy(attestation, domain, owner(wallet))).toBe(true);
  });

  test("issues a proof the same commitment can verify", async () => {
    const wallet = Wallet.createRandom();
    const { commitment } = await attestDay(walletSigner(wallet), domain, {
      city: "johannesburg",
      day,
      leaves,
    });
    for (const leaf of leaves) {
      const proof = paymentProof(commitment, leaf.ispId);
      expect(verify(proof)).toBe(true);
      expect(proof.merkleRoot).toBe(commitment.root);
    }
  });

  test("answers for one ISP without revealing the rest", async () => {
    const wallet = Wallet.createRandom();
    const { commitment } = await attestDay(walletSigner(wallet), domain, {
      city: "johannesburg",
      day,
      leaves,
    });
    const proof = paymentProof(commitment, "isp_alpha");
    // The proof says one thing about one ISP. The fact that another ISP is
    // absent is answerable without a statement that one was.
    expect(() => paymentProof(commitment, "isp_delta")).toThrow(/No payment for that ISP/);
    expect(proof.amount).toBe(usdc(2_000));
  });

  test("keeps two days apart", async () => {
    const wallet = Wallet.createRandom();
    const signer = walletSigner(wallet);
    const first = await attestDay(signer, domain, { city: "johannesburg", day, leaves });
    const second = await attestDay(signer, domain, {
      city: "johannesburg",
      day: 20260929,
      leaves: [{ ispId: "isp_alpha", amount: usdc(9_000) }],
    });
    // Same ISP, same city, same signer. Different day, different root, different
    // digest — otherwise yesterday's proof would verify today.
    expect(first.commitment.root).not.toBe(second.commitment.root);
    expect(verifyAttestation(first.attestation, domain).digest).not.toBe(
      verifyAttestation(second.attestation, domain).digest,
    );
  });
});

describe("address handling", () => {
  test("normalises the signer before comparing it", () => {
    // Comparisons are string comparisons. A checksummed signer address from one
    // library and a lowercase one from another must compare equal.
    const wallet = Wallet.createRandom();
    const mixed = checksumAddress(wallet.address);
    expect(normalizeAddress(mixed)).toBe(wallet.address.toLowerCase());
  });

  test("asserts a signature is 65 bytes", () => {
    expect(() => assertSignature("0xab", "sig")).toThrow(/65-byte/);
    expect(assertSignature(`0x${"11".repeat(32)}${"22".repeat(32)}1b`, "sig")).toHaveLength(132);
  });
});
