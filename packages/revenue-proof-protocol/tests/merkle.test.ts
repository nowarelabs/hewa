import { describe, expect, test } from "vite-plus/test";
import { usdc, type DayKey, type Hex32 } from "@hewa/blockchain-types";
import {
  commitToRevenue,
  hashLeaf,
  hashPair,
  pathFor,
  rootFromPath,
  rootOf,
  verify,
  type RevenueLeaf,
} from "../src/index.ts";

const day: DayKey = 20260928;

/** Pinned by `contracts/test/Merkle.t.sol`; keep the two in step. */
const MERKLE_VECTORS = {
  leafAlpha: "0xfdb00e97e44abee183779be8b4e2db1d4bd09fbb5a0ba8c18b41513233cbe500",
  leafBravo: "0x0c395dd83789da3c73364541659834e34613f070dcaa1722cfd84f22a10336be",
  pairAlphaBravo: "0xe93454a2ff8b33812031450d8266ed890c5c50dd3c40f176d76cbf7cccb00d6c",
  twoLeafRoot: "0xe93454a2ff8b33812031450d8266ed890c5c50dd3c40f176d76cbf7cccb00d6c",
  threeLeafRoot: "0x7e2509137e5f5a437acd542be0e3b0ca652510fee0a0df4fe83131794d87f303",
} as const satisfies Record<string, Hex32>;
const leaves: RevenueLeaf[] = [
  { ispId: "isp_alpha", amount: usdc(2_000) },
  { ispId: "isp_bravo", amount: usdc(1_500) },
  { ispId: "isp_charlie", amount: usdc(3_200) },
];

describe("leaf hashing", () => {
  test("is a 32-byte keccak hash", () => {
    const leaf = hashLeaf("isp_alpha", usdc(2_000), day);
    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("changes when the day changes", () => {
    // The day is in the leaf because the same payment on a different day is a
    // different fact, and a proof for Tuesday must not verify for Wednesday.
    expect(hashLeaf("isp_alpha", usdc(2_000), day)).not.toBe(
      hashLeaf("isp_alpha", usdc(2_000), 20260929),
    );
  });

  test("changes when the amount changes by one base unit", () => {
    expect(hashLeaf("isp_alpha", usdc(2_000), day)).not.toBe(
      hashLeaf("isp_alpha", usdc(2_000) + 1n, day),
    );
  });

  test("changes when the ISP changes", () => {
    expect(hashLeaf("isp_alpha", usdc(2_000), day)).not.toBe(
      hashLeaf("isp_bravo", usdc(2_000), day),
    );
  });

  test("cannot be confused with an internal node", () => {
    // Without a domain separator a leaf could be replayed as a pair, which is
    // a second preimage and stops the root committing to the leaf set.
    const leaf = hashLeaf("isp_alpha", usdc(2_000), day);
    expect(hashPair(leaf, leaf)).not.toBe(leaf);
  });
});

describe("committing to a day", () => {
  test("roots the tree and totals the leaves", () => {
    const commitment = commitToRevenue("johannesburg", day, leaves);
    expect(commitment.leafCount).toBe(3);
    expect(commitment.total).toBe(usdc(6_700));
    expect(commitment.root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("a single leaf roots to itself", () => {
    const one = [{ ispId: "isp_solo", amount: usdc(500) }];
    expect(commitToRevenue("kampala", day, one).root).toBe(hashLeaf("isp_solo", usdc(500), day));
  });

  test("the root changes if any leaf changes", () => {
    const original = commitToRevenue("johannesburg", day, leaves).root;
    const tampered = commitToRevenue("johannesburg", day, [
      leaves[0]!,
      leaves[1]!,
      { ispId: "isp_charlie", amount: usdc(3_201) },
    ]).root;
    expect(tampered).not.toBe(original);
  });

  test("the root changes if a leaf is removed", () => {
    const full = commitToRevenue("johannesburg", day, leaves).root;
    const short = commitToRevenue("johannesburg", day, leaves.slice(0, 2)).root;
    // Dropping a payer has to be visible, or a day can be shrunk after the fact.
    expect(short).not.toBe(full);
  });

  test("refuses an empty day", () => {
    // The keccak of nothing is a constant, so an empty commitment would publish
    // a well-known root that anyone could present as a day with revenue.
    expect(() => commitToRevenue("johannesburg", day, [])).toThrow(/at least one payment/);
    expect(() => rootOf([])).toThrow(/empty set/);
  });

  test("refuses a zero or negative payment", () => {
    expect(() => commitToRevenue("johannesburg", day, [{ ispId: "a", amount: 0n }])).toThrow(
      /positive amount/,
    );
    expect(() => commitToRevenue("johannesburg", day, [{ ispId: "a", amount: -1n }])).toThrow(
      /positive amount/,
    );
  });

  test("refuses the same ISP twice", () => {
    // One ISP appearing twice means one payment counted twice, and a bondholder
    // asking about that ISP would get whichever came first.
    expect(() =>
      commitToRevenue("johannesburg", day, [
        { ispId: "isp_alpha", amount: usdc(1_000) },
        { ispId: "isp_alpha", amount: usdc(1_000) },
      ]),
    ).toThrow(/once in a day/);
  });

  test("refuses a blank ISP id", () => {
    expect(() => commitToRevenue("johannesburg", day, [{ ispId: "  ", amount: usdc(1) }])).toThrow(
      /ISP id/,
    );
  });
});

describe("proofs", () => {
  const commitment = commitToRevenue("johannesburg", day, leaves);

  test("verifies for every leaf in the tree", () => {
    for (const [index, leaf] of leaves.entries()) {
      const proof = {
        ispId: leaf.ispId,
        amount: leaf.amount,
        city: "johannesburg",
        day,
        merkleRoot: commitment.root,
        path: pathFor(leaves, index, day),
      };
      expect(verify(proof)).toBe(true);
    }
  });

  test("verifies when the leaf count is even", () => {
    // Two and four leaves exercise the pairing without the odd-leaf duplicate.
    const even = leaves.slice(0, 2);
    const root = commitToRevenue("kampala", day, even).root;
    for (const [index, leaf] of even.entries()) {
      expect(
        verify({
          ispId: leaf.ispId,
          amount: leaf.amount,
          city: "kampala",
          day,
          merkleRoot: root,
          path: pathFor(even, index, day),
        }),
      ).toBe(true);
    }
  });

  test("verifies a single-leaf tree", () => {
    const one = [{ ispId: "isp_solo", amount: usdc(500) }];
    const root = commitToRevenue("kampala", day, one).root;
    expect(
      verify({
        ispId: "isp_solo",
        amount: usdc(500),
        city: "kampala",
        day,
        merkleRoot: root,
        path: pathFor(one, 0, day),
      }),
    ).toBe(true);
  });

  test("rejects a proof whose amount was inflated", () => {
    const proof = {
      ispId: "isp_alpha",
      amount: usdc(2_000),
      city: "johannesburg",
      day,
      merkleRoot: commitment.root,
      path: pathFor(leaves, 0, day),
    };
    // The attack a proof system exists to stop: keep the real path and the real
    // root, change only the number being claimed.
    expect(verify({ ...proof, amount: usdc(2_000_000) })).toBe(false);
  });

  test("rejects a proof for a different ISP", () => {
    const path = pathFor(leaves, 0, day);
    expect(
      verify({
        ispId: "isp_bravo",
        amount: usdc(2_000),
        city: "johannesburg",
        day,
        merkleRoot: commitment.root,
        path,
      }),
    ).toBe(false);
  });

  test("rejects a proof for a different day", () => {
    const path = pathFor(leaves, 0, day);
    expect(
      verify({
        ispId: "isp_alpha",
        amount: usdc(2_000),
        city: "johannesburg",
        day: 20260929,
        merkleRoot: commitment.root,
        path,
      }),
    ).toBe(false);
  });

  test("rejects a proof against another day's root", () => {
    const otherDay = commitToRevenue("johannesburg", 20260929, leaves).root;
    expect(
      verify({
        ispId: "isp_alpha",
        amount: usdc(2_000),
        city: "johannesburg",
        day,
        merkleRoot: otherDay,
        path: pathFor(leaves, 0, day),
      }),
    ).toBe(false);
  });

  test("rejects a proof with a doctored sibling", () => {
    const path = pathFor(leaves, 0, day);
    const forged: Hex32 = `0x${"ff".repeat(32)}`;
    expect(
      verify({
        ispId: "isp_alpha",
        amount: usdc(2_000),
        city: "johannesburg",
        day,
        merkleRoot: commitment.root,
        path: { ...path, siblings: [forged, ...path.siblings.slice(1)] },
      }),
    ).toBe(false);
  });

  test("rejects a truncated path", () => {
    // Re-deriving from fewer siblings lands on an intermediate node, never the
    // published root.
    const path = pathFor(leaves, 0, day);
    expect(
      verify({
        ispId: "isp_alpha",
        amount: usdc(2_000),
        city: "johannesburg",
        day,
        merkleRoot: commitment.root,
        path: { ...path, siblings: path.siblings.slice(0, -1) },
      }),
    ).toBe(false);
  });

  test("rejects an index that is not a leaf", () => {
    expect(() => pathFor(leaves, 3, day)).toThrow(/No leaf at that index/);
    expect(() => pathFor(leaves, -1, day)).toThrow(/No leaf at that index/);
  });

  test("has a uniform path length for an odd leaf count", () => {
    // Three leaves duplicate the last, so every path is two deep. A verifier
    // that special-cased odd trees would be a verifier with a bug in it.
    const lengths = leaves.map((_, index) => pathFor(leaves, index, day).siblings.length);
    expect(new Set(lengths).size).toBe(1);
    expect(lengths[0]).toBe(2);
  });

  test("re-derives the root independently of the commitment", () => {
    const path = pathFor(leaves, 1, day);
    expect(rootFromPath(path)).toBe(commitment.root);
  });
});

describe("order independence", () => {
  test("a different ordering gives a different root and different proofs", () => {
    // Leaves are committed in the order the ledger produced them, so a
    // reordered day is a different commitment. Verification still works: the
    // index travels with the proof.
    const reordered = [leaves[2]!, leaves[0]!, leaves[1]!];
    const root = commitToRevenue("johannesburg", day, reordered).root;
    expect(root).not.toBe(commitToRevenue("johannesburg", day, leaves).root);

    for (const [index, leaf] of reordered.entries()) {
      expect(
        verify({
          ispId: leaf.ispId,
          amount: leaf.amount,
          city: "johannesburg",
          day,
          merkleRoot: root,
          path: pathFor(reordered, index, day),
        }),
      ).toBe(true);
    }
  });
});

describe("vectors a Solidity verifier must reproduce", () => {
  // The contract has to compute the identical root. These vectors are the
  // cross-implementation contract between `merkle.ts` and `MerkleLib.sol`: if the
  // off-chain root and the on-chain root ever disagree, every published
  // attestation silently becomes unverifiable, so the values are pinned here and
  // asserted again by the Solidity suite.
  test("the committed root matches the pinned contract vector", () => {
    expect(commitToRevenue("johannesburg", day, leaves).root).toBe(MERKLE_VECTORS.threeLeafRoot);
  });

  test("the two-leaf root matches the pinned contract vector", () => {
    expect(commitToRevenue("kampala", day, leaves.slice(0, 2)).root).toBe(
      MERKLE_VECTORS.twoLeafRoot,
    );
  });

  test("the leaf hash matches the pinned contract vector", () => {
    expect(hashLeaf("isp_alpha", usdc(2_000), day)).toBe(MERKLE_VECTORS.leafAlpha);
  });

  test("the pair hash matches the pinned contract vector", () => {
    expect(hashPair(MERKLE_VECTORS.leafAlpha, MERKLE_VECTORS.leafBravo)).toBe(
      MERKLE_VECTORS.pairAlphaBravo,
    );
  });
});
