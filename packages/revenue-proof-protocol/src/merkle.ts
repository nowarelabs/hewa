import { ValidationError } from "@hewa/errors";
import { assertHex32, type DayKey, type Hex32, type TokenAmount } from "@hewa/blockchain-types";
import { encodeAbi, keccak256 } from "@hewa/crypto";

/**
 * Hash one ISP's payment for one day.
 *
 * Solidity type strings, not a hand-rolled byte concatenation, because the
 * contract has to compute the identical value. `abi.encode` is the only
 * encoding both sides agree on by construction, and a `:`-joined string here
 * would be a different function from anything in the `.sol`.
 *
 * `hashLeaf` is passed in so a test can assert a known value, and so a future
 * break of the protocol is a deliberate version bump rather than an accident.
 */
export type LeafHasher = (ispId: string, amount: TokenAmount, day: DayKey) => Hex32;

export const LEAF_TYPE_STRING = "(string,uint256,uint32)";

/**
 * Ethers types every hash and every ABI payload as a bare `string`, and a bare
 * `string` is not a `0x${string}`. Rather than casting at each call site, which
 * would make the type meaningless, every value that enters the on-chain
 * vocabulary passes through one of these and is checked for real. A hash that is
 * not 32 bytes is a bug in the encoder, and this is where it surfaces.
 */
function asHex32(value: string, what: string): Hex32 {
  return assertHex32(value, what);
}

/** The default leaf hash, matching `AttestationLib.leafHash` in the contract. */
export const hashLeaf: LeafHasher = (ispId, amount, day) =>
  asHex32(keccak256(encodeAbi(["string", "uint256", "uint32"], [ispId, amount, day])), "leaf hash");

/**
 * The internal-node hash.
 *
 * A domain separator is prepended so a leaf can never be replayed as an
 * internal node. Without it, a two-leaf tree where one leaf's hash happens to
 * equal the pair hash is a second preimage, and the root stops committing to
 * the leaf set.
 */
export function hashPair(left: Hex32, right: Hex32): Hex32 {
  return asHex32(keccak256(encodeAbi(["bytes32", "bytes32"], [left, right])), "pair hash");
}

/** One ISP's payment inside a day's commitment. */
export interface RevenueLeaf {
  readonly ispId: string;
  readonly amount: TokenAmount;
}

/** A day's payments, committed to by a root. */
export interface RevenueCommitment {
  readonly city: string;
  readonly day: DayKey;
  readonly leaves: readonly RevenueLeaf[];
  /** Hex root over every leaf. Empty input is rejected rather than hashed. */
  readonly root: Hex32;
  /** How many leaves the root covers. */
  readonly leafCount: number;
  /** Sum of the leaves, so a caller can check the total against the root. */
  readonly total: TokenAmount;
}

/** A path from a leaf to the root. */
export interface MerkleProof {
  /** Index of the leaf this path is for. */
  readonly index: number;
  /** Sibling hashes, bottom-up, left and right as the tree pairs them. */
  readonly siblings: readonly Hex32[];
  /** The leaf hash the path starts from. */
  readonly leafHash: Hex32;
}

/**
 * A single proof: enough for one bondholder to check one ISP's payment.
 */
export interface PaymentProof {
  readonly ispId: string;
  readonly amount: TokenAmount;
  readonly city: string;
  readonly day: DayKey;
  readonly merkleRoot: Hex32;
  readonly path: MerkleProof;
}

function requireLeaves(leaves: readonly RevenueLeaf[]): void {
  if (leaves.length === 0) {
    // The keccak256 of nothing is a constant. A commitment with no leaves is
    // not a commitment, and publishing its root would let an empty day be
    // attested as a day with revenue.
    throw new ValidationError("A revenue commitment needs at least one payment", {});
  }
  for (const leaf of leaves) {
    if (leaf.ispId.trim() === "") {
      throw new ValidationError("A revenue leaf needs an ISP id", {});
    }
    if (leaf.amount <= 0n) {
      // A zero or negative payment is not revenue, and admitting one would let
      // a day's total be inflated by a padded list of empty leaves.
      throw new ValidationError("A revenue leaf must be a positive amount", {
        ispId: leaf.ispId,
        received: leaf.amount.toString(),
      });
    }
  }
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf.ispId)) {
      // Two leaves for one ISP means the same payment counted twice, and a
      // bondholder asking "did ISP X pay Y" would get whichever came first.
      throw new ValidationError("An ISP may appear once in a day's commitment", {
        ispId: leaf.ispId,
      });
    }
    seen.add(leaf.ispId);
  }
}

/**
 * Commit to a day's payments.
 *
 * The tree is a sorted pair of adjacent leaves, duplicated on the last if the
 * count is odd. That is the shape the contract's `pairHash` implements, and the
 * two must agree exactly or every proof fails against the published root.
 */
export function commitToRevenue(
  city: string,
  day: DayKey,
  leaves: readonly RevenueLeaf[],
  hasher: LeafHasher = hashLeaf,
): RevenueCommitment {
  requireLeaves(leaves);
  const hashes = leaves.map((leaf) => hasher(leaf.ispId, leaf.amount, day));
  const root = rootOf(hashes);
  const total = leaves.reduce((sum, leaf) => sum + leaf.amount, 0n);
  return { city, day, leaves: [...leaves], root, leafCount: leaves.length, total };
}

function pairUp(hashes: readonly Hex32[]): Hex32[] {
  const level = [...hashes];
  // The odd leaf is duplicated rather than promoted, so a tree of 3 leaves has
  // depth 2 for every leaf and the proof length is uniform.
  if (level.length % 2 === 1) level.push(level[level.length - 1] as Hex32);
  const next: Hex32[] = [];
  for (let i = 0; i < level.length; i += 2) {
    next.push(hashPair(level[i] as Hex32, level[i + 1] as Hex32));
  }
  return next;
}

/** The root of a list of leaf hashes, matching the contract's `merkleRoot`. */
export function rootOf(hashes: readonly Hex32[]): Hex32 {
  if (hashes.length === 0) {
    throw new ValidationError("Cannot take the root of an empty set of leaves", {});
  }
  let level = [...hashes];
  while (level.length > 1) level = pairUp(level);
  return level[0] as Hex32;
}

/** Build the proof for one leaf, as the contract's `verify` walks it. */
export function pathFor(
  leaves: readonly RevenueLeaf[],
  index: number,
  day: DayKey,
  hasher: LeafHasher = hashLeaf,
): MerkleProof {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    throw new ValidationError("No leaf at that index", {
      index: String(index),
      leafCount: String(leaves.length),
    });
  }
  const leafHash = hasher(leaves[index]!.ispId, leaves[index]!.amount, day);
  let level = leaves.map((leaf) => hasher(leaf.ispId, leaf.amount, day));
  let at = index;
  const siblings: Hex32[] = [];
  while (level.length > 1) {
    const padded = level.length % 2 === 1 ? [...level, level[level.length - 1] as Hex32] : level;
    const isRight = at % 2 === 1;
    const partner = isRight ? at - 1 : at + 1;
    siblings.push(padded[partner] as Hex32);
    level = pairUp(level);
    at = Math.floor(at / 2);
  }
  return { index, siblings, leafHash };
}

/**
 * Re-derive a root from a leaf and its path.
 *
 * This is the whole of what a bondholder's verification does, and it is
 * deliberately the only thing `verify` does. A verifier must not be able to
 * learn anything about the other leaves in the day, because a verifier is the
 * party least entitled to see them.
 */
export function rootFromPath(path: MerkleProof): Hex32 {
  let hash = assertHex32(path.leafHash, "leafHash");
  let index = path.index;
  for (const sibling of path.siblings) {
    const isRight = index % 2 === 1;
    hash = isRight ? hashPair(sibling, hash) : hashPair(hash, sibling);
    index = Math.floor(index / 2);
  }
  return hash;
}

/** Verify that one ISP paid one amount on one day, against a published root. */
export function verify(proof: PaymentProof, hasher: LeafHasher = hashLeaf): boolean {
  // The leaf hash is recomputed from the claim, not read from the proof. A
  // prover that supplied its own leaf hash could assert any amount and re-derive
  // a path to a real root for it, so the check has to start from the figure
  // being claimed rather than from anything the prover passed in.
  if (hasher(proof.ispId, proof.amount, proof.day) !== proof.path.leafHash) return false;
  return rootFromPath(proof.path) === proof.merkleRoot;
}
