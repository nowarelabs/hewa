import type { Currency, Money } from "@hewa/marketplace-types";

/**
 * Daily revenue attestations, and whether a month of them is finished.
 *
 * ## What is deliberately absent
 *
 * No Merkle root, no signature, no reserves figure, and no chain address on this
 * record. That is not an omission to be filled in later, it is the point.
 *
 * `@hewa/revenue-proof-protocol` exists to answer "was this day's revenue signed
 * over the right commitment", and answering it needs a private key and a chain.
 * Anything this dashboard stored of that sort would be a row an operator could edit
 * into agreeing with the books, which is the one thing a proof of reserves must not
 * be: a check that reads the same table twice proves nothing, and a check whose
 * input a web form can change proves less than nothing.
 *
 * So the record holds the **figures that are ours** — the day's gross, its costs and
 * the net — and the verdict below, and the root stays where it belongs, in the
 * attestation job that signs it and the contract that verifies it. The dashboard's
 * job is to show a month is unfinished; the chain's job is to say whether it is
 * honest. Neither can do the other's half.
 */
export interface AttestationRecord {
  readonly id: string;
  readonly city: string;
  /** The month this day belongs to, as `YYYY-MM`. Stored, and checked in the database. */
  readonly month: string;
  /** Day of that month, 1 to 31. */
  readonly day: number;
  readonly currency: Currency;
  readonly gross: Money;
  readonly costs: Money;
  /** `gross - costs`, and never negative: a city does not pay the operator to serve it. */
  readonly netRevenue: Money;
  /** RFC 3339. When the day's figures were signed and published. */
  readonly publishedAt: string;
  /**
   * How complete this day's **city's month** is.
   *
   * One verdict for the `(city, month)` pair, carried on every one of its days, and
   * that is what makes it filterable: an operator asking "who is short a day" gets
   * one chip per verdict and every day of a short city-month is in it, rather than a
   * verdict that belongs to no particular row.
   *
   * Per city-month and not per month, because a month holds one row per city per
   * day and the operator's question is about the customer: a month with Nairobi
   * complete and Mombasa twelve days short is complete for one of its cities and
   * partial for another, and a single verdict for the month would have to be wrong
   * about one of them.
   */
  readonly verdict: AttestationVerdict;
}

/**
 * Whether a city's month carries a complete set of daily attestations.
 *
 * Coverage, not agreement. `complete` says every day of that city's month is
 * published; `partial` says some are.
 *
 * ## Why there is no third verdict for a month with nothing in it
 *
 * Because a city with no signed days in a month has no rows, and the verdict travels
 * on the rows. A `none` member would be a value no row could ever hold, so the chip for it
 * would filter to an empty list on every dataset — a control that is permanently
 * dead and looks pressable, which is worse than no chip. A month that has published
 * nothing is visible instead: its absence from `meta.groups` means no row is in it,
 * and the summary figure for it is zero.
 *
 * It is deliberately *not* `@hewa/revenue-proof-protocol`'s reserves verdict, which
 * compares the signed on-chain total against the internal books and fails by one
 * base unit. That check needs the on-chain total, which this table does not hold —
 * see the module comment — so calling this a reserves check would be a name for a
 * weaker claim. When this dashboard can read the signed totals, the real verdict
 * arrives beside this one rather than replacing it: coverage is still the question a
 * finance operator asks first, because a month missing a day is missing before it is
 * wrong.
 */
export const ATTESTATION_VERDICTS = ["complete", "partial"] as const;

export type AttestationVerdict = (typeof ATTESTATION_VERDICTS)[number];

/**
 * How each verdict is written where a human reads it.
 *
 * "Complete" and "Partial" alone, with no "of the month" appended: the chip is
 * drawn beside a city's rows in a section already titled with the month, and a
 * chip that spells out its own context is a label two letters long where a
 * sentence is needed.
 */
export const ATTESTATION_VERDICT_TITLES: Readonly<Record<AttestationVerdict, string>> = {
  complete: "Complete",
  partial: "Partial",
};
