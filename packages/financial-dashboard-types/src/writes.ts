/**
 * The financial dashboard's write contract: what may be created and what may be
 * changed, and — the larger half of it — what may not be touched at all.
 *
 * ## Every resource here has fewer verbs than the admin console's
 *
 * The admin console gives each of its six tables `POST`, `PUT`, `PATCH` and
 * sometimes `DELETE`, because an operator editing a node or an alert is correcting
 * a row that ought never to have been wrong. Finance is the other case, and copying
 * that surface here would put five buttons on each of five tables that a finance
 * operator has no business pressing:
 *
 * | Resource         | Verb    | Body sets                          | Why not more |
 * | ---------------- | ------- | ---------------------------------- | ------------ |
 * | `bills`          | `PATCH` | `status`, `disputeReason`          | A bill is issued by the billing run. An operator may mark it disputed or paid; they may not retype its charges, because the charges were metered. |
 * | `credits`        | `POST`  | the whole credit                   | A credit is the correction. Editing one silently is a mistake with no audit; issuing a second is visible. |
 * | `payouts`        | `PATCH` | `status`, `failureReason`          | A payout moves through a state machine. The transition is the edit; the amounts were quoted when it was created, and a `failed` move is the one transition that is not self-describing. |
 * | `ledger_entries` | `POST`  | id, reference, postings           | A journal entry is immutable once posted, because its postings are what every balance is the sum of. |
 * | `attestations`   | `POST`  | city, day, figures                 | An attestation exists only once signed, so publishing it and recording it are one act. |
 *
 * `FINANCE_WRITE_VERBS` is that table as data, and the app's editor registry keys
 * off it rather than hardcoding five verbs — so a resource added here without an
 * editor is a type error rather than a button that posts to a 404.
 *
 * ## Nothing is deletable
 *
 * There is no `DELETE` on any of these five, and the admin console has two tables
 * that accept one. A deleted bill is a month that was never issued; a deleted
 * journal entry is a balance that was never wrong. Both are corrections the ledger
 * has to be able to *explain*, and an entry that is simply gone is a hole with a
 * number over it. So a mistake is corrected by writing it forward — a `void` bill, a
 * reversing entry, a failed payout — and every correction is a row somebody can
 * read. That is the whole argument for `BILL_STATUSES` carrying `void` and for
 * `PayoutStatus` carrying `failed`, and neither is there for the UI's benefit.
 *
 * ## No root, no signature, no reserves figure
 *
 * `AttestationCreate` carries the day's revenue and its costs and nothing else. The
 * Merkle root and the signature are produced by `@hewa/revenue-proof-protocol`'s
 * attestation job, and a payload that could name a root would let a web form assert
 * a proof. See `proof.ts`.
 */
import type { Bill, BillStatus, CreditBasis, CreditRecord } from "./billing.js";
import type { LedgerEntryRecord } from "./ledger.js";
import type { Currency } from "@hewa/marketplace-types";
import type { PayoutRecord, PayoutStatus } from "./payouts.js";
import type { AttestationRecord } from "./proof.js";

/**
 * The five things the financial dashboard can write.
 *
 * Named after the table rather than after the view, for the reason the console's
 * list is: a view holds several sections and only one of them is the row.
 */
export const FINANCE_WRITE_RESOURCES = [
  "bills",
  "credits",
  "payouts",
  "ledger_entries",
  "attestations",
] as const;

export type FinanceWriteResource = (typeof FINANCE_WRITE_RESOURCES)[number];

/** The verbs any resource here can accept. `upsert` is listed for completeness and used by none: see the table above. */
export type FinanceVerb = "create" | "upsert" | "patch";

/**
 * The verbs each resource accepts, at runtime.
 *
 * Absent from this union's arms is the point: there is no `upsert` on any finance
 * resource, because an upsert is a replace, and a replace is how a caller overwrites
 * a metered figure with a typed one. It is in {@link FinanceVerb} only so the app's
 * editor registry can be written against the full verb set and fail loudly if one is
 * added to a resource that has no business accepting it.
 */
export const FINANCE_WRITE_VERBS: Readonly<Record<FinanceWriteResource, readonly FinanceVerb[]>> = {
  bills: ["patch"],
  credits: ["create"],
  payouts: ["patch"],
  ledger_entries: ["create"],
  attestations: ["create"],
};

export function writeVerbs(resource: FinanceWriteResource): readonly FinanceVerb[] {
  return FINANCE_WRITE_VERBS[resource];
}

/**
 * The record a write returns, keyed by resource.
 *
 * A write answers with the record it just wrote and nothing else — no envelope, no
 * `{ ok: true }`. The envelope exists to carry `meta.groups` beside a *list*, and a
 * single record has no groups to carry; and "was it created" is already in the
 * status. So a panel reads the same shape it drew before the edit.
 *
 * A map rather than a union so a generic editor is typed against
 * `FinanceWriteRecords[R]` for the resource `R` it was given, and a resource added
 * here without an editor is a type error in the editor's registry rather than an
 * `undefined` on a screen.
 */
export interface FinanceWriteRecords {
  readonly bills: Bill;
  readonly credits: CreditRecord;
  readonly payouts: PayoutRecord;
  readonly ledger_entries: LedgerEntryRecord;
  readonly attestations: AttestationRecord;
}

/**
 * The prefix each writable resource's ids are written with.
 *
 * A convention and not a constraint: the columns are `varchar(64)` primary keys with
 * no default, so a create names its own row. The prefix is here because it is what
 * the seed data writes, so a form that generates an id with it produces a key that
 * reads like the ones already in the table and cannot collide with them by accident.
 *
 * Every one of the three `POST` forms generates its own id from this prefix, and the
 * service refuses a create whose id already exists rather than overwriting the row
 * that is there. For a journal entry that is only half of it: a second entry for the
 * same `reference` is a second attempt at the same posting, and it is the unique
 * index on `reference` — not the id — that refuses it.
 */
export const WRITE_ID_PREFIXES: Readonly<Record<FinanceWriteResource, string>> = {
  bills: "bil-",
  credits: "crd-",
  payouts: "pay-",
  ledger_entries: "jrn-",
  attestations: "att-",
};

/**
 * What a caller may change on a bill.
 *
 * Two fields, and that is the point: a bill's charges were metered and its totals
 * are the sum of its breakdown, so a caller that could retype them would let the
 * screen disagree with the meter. `disputeReason` is nullable because clearing a
 * dispute means clearing its reason, and absent is not the same as an empty string.
 *
 * The service applies two rules the type cannot: `disputed` requires a reason, and
 * the move has to be one the status allows.
 */
export interface BillPatch {
  readonly status?: BillStatus;
  readonly disputeReason?: string | null;
}

export type BillCreate = never;
export type BillUpsert = never;

/** Everything a caller may set on a credit. */
export interface CreditCreate {
  readonly id: string;
  /** The bill being credited. A foreign key, so a credit cannot exist unattached. */
  readonly billId: string;
  /**
   * The credit, in minor units.
   *
   * Signed and never positive: the ledger's convention, and the same one
   * `MonthlyBill.slaCredit` follows. The database refuses a positive credit.
   */
  readonly amountMinor: number;
  readonly basis: CreditBasis;
  /** What the credit was for. Required. */
  readonly note: string;
  /** RFC 3339. */
  readonly recordedAt: string;
}

/** A credit is issued whole; there is no partial update of an issued credit. */
export type CreditPatch = never;
export type CreditUpsert = never;

/**
 * What a caller may change on a payout.
 *
 * `status` and `failureReason`, and the second field is here because the first is not
 * usable without it: `finance_payouts` refuses a `failed` row with no reason and a
 * moving row with one, so a patch that could only set a status could never mark a
 * payout failed at all. A `PATCH` naming an illegal transition is a 422 that says
 * which transition was refused, because a status field an operator can set to
 * anything is how a payout gets marked `completed` while its money is still
 * converting.
 *
 * Both fields go together or neither does: a transition *to* `failed` requires a
 * reason, and a transition *from* `failed` — to `sending`, on a retry — must clear
 * it. The column check would catch both, in a 500-ish constraint error, rather than
 * a 422 naming the field, so the two are refined together in the write schema.
 */
export interface PayoutPatch {
  readonly status: PayoutStatus;
  /** Required when `status` is `failed`, and forbidden otherwise. */
  readonly failureReason?: string | null;
}

export type PayoutCreate = never;
export type PayoutUpsert = never;

/** One side of a journal entry, in a write. */
export interface LedgerPostingWrite {
  readonly accountId: string;
  /** Signed amount in minor units. */
  readonly amountMinor: number;
}

/**
 * Everything a caller may set on a journal entry.
 *
 * `postings` is a list and the service can reject an unbalanced entry before it is
 * written: it calls `@hewa/ledger-accounting`'s `assertBalanced` on the postings it
 * was sent. That check is the reason this package exists, and a web form cannot be
 * the place where it is skipped.
 *
 * `id` and `reference` are both required and both the caller's to name, because a
 * create that is idempotent under retry has to be re-postable *byte for byte*: a
 * settlement pipeline that times out after the insert and retries must send the same
 * id it sent the first time, or the retry is a second entry with a second key that no
 * unique index can tell from a genuine second posting. That is also why the form
 * generates an id and does not leave it to the service to invent one per attempt.
 */
export interface LedgerEntryCreate {
  readonly id: string;
  /**
   * What this entry is for, and unique.
   *
   * The second half of the retry argument above: one entry per reference, so the
   * *same* posting sent twice is refused by the index even under a new id.
   */
  readonly reference: string;
  readonly description: string;
  /** RFC 3339. */
  readonly occurredAt: string;
  readonly currency: Currency;
  readonly postings: readonly LedgerPostingWrite[];
}

export type LedgerEntryPatch = never;
export type LedgerEntryUpsert = never;

/**
 * Everything a caller may set on an attestation.
 *
 * Creating one *is* publishing it: a row that has not been signed is not a
 * half-finished attestation, it is nothing, so `publishedAt` is stamped by the
 * service rather than sent and there is no draft state to move through.
 *
 * `netRevenue` is absent. It is `gross - costs`, and the service computes it with
 * the same subtraction every other net in this workspace is computed with — a
 * payload carrying it would be a third figure for the same day's money.
 */
export interface AttestationCreate {
  readonly id: string;
  readonly city: string;
  /** The month, as `YYYY-MM`. Stored rather than derived from a day key, so a form asks for what a person knows. */
  readonly month: string;
  /** Day of that month, 1 to 31. */
  readonly day: number;
  readonly currency: Currency;
  readonly grossMinor: number;
  readonly costsMinor: number;
}

export type AttestationPatch = never;
export type AttestationUpsert = never;

/**
 * The write payload for each resource, keyed by resource.
 *
 * Keyed by the **verb the resource accepts**, and the verb is part of the key:
 * `bills` is `BillPatch` because `PATCH /data/bills/:id` is the only route that
 * exists for it, and a `POST /data/bills` returning 404 would be discovered by
 * reading a controller rather than by a type error here.
 */
export interface FinanceWritePayloads {
  readonly bills: BillPatch;
  readonly credits: CreditCreate;
  readonly payouts: PayoutPatch;
  readonly ledger_entries: LedgerEntryCreate;
  readonly attestations: AttestationCreate;
}
