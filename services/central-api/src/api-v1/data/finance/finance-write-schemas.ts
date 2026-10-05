/**
 * What a finance write body may contain, checked by Zod before the service sees it.
 *
 * Every reason in `../write-schemas.ts` applies here, and one applies harder: this
 * workspace now has eleven writable tables and two vocabularies that a finance write
 * can contradict rather than merely miss.
 *
 * ## The three refusals that are not about shape
 *
 * - **A `disputed` bill carries a reason and no other bill does.** The column check
 *   says it, but a column check answers with a SQLSTATE and the caller's field is
 *   somewhere in a `details.issues` list. Refused here, it is a 422 naming
 *   `disputeReason`, which is the field an operator has to fill in.
 * - **A `failed` payout carries a reason and a moving payout does not.** Same shape
 *   of rule, and it is why `PayoutPatch` has a `failureReason` at all: a patch that
 *   could only set a status could never mark a payout failed.
 * - **A credit is negative.** `finance_credits_amount_lte_zero` refuses the other
 *   sign, and a positive "credit" is a charge under a column named after a
 *   reduction — the one figure in this schema whose sign is load-bearing for
 *   `revenue/receivables`.
 *
 * ## What is deliberately *not* here
 *
 * Bill amounts, payout amounts, chart balances and the attestation's `netRevenue` are
 * all derived, so no schema accepts them. A body that could set a bill's total would
 * be a second way to state what `finance_bills`' three charge columns already say,
 * and the invoice on screen would disagree with the sum.
 */
import {
  BILL_STATUSES,
  CREDIT_BASES,
  type AttestationCreate,
  type BillPatch,
  type CreditCreate,
  type LedgerEntryCreate,
  type PayoutPatch,
} from "@hewa/financial-dashboard-types";
import { PAYOUT_STATUSES } from "@hewa/settlement-domain";
import { CURRENCIES } from "@hewa/marketplace-types";
import { z } from "zod";

/**
 * A row's own key, length-bounded to the column's `varchar(64)`.
 *
 * `billId` is the same bound because a reference to a row that cannot exist is a
 * reference to nothing, and a 400 that says so is better than a 500 from the driver.
 *
 * Exported because it is also the `:id` param of the two `PATCH` routes, and a path
 * parameter is checked *before* the body: an id of 200 characters has to be refused
 * as the id it is, not as "bill patch was not accepted", which is what a 422 built
 * from the body would say.
 */
export const FINANCE_ID = z.string().min(1).max(64);

/** A month, as `YYYY-MM`, matching `finance_bills_month_format`. */
const MONTH = z.string().regex(/^[0-9]{4}-[0-9]{2}$/, "expected YYYY-MM");

/** A day of a month, 1 to 31. `finance_attestations_day_in_range` is the column's. */
const DAY = z.int().min(1).max(31);

/** An instant as the contract sends it: ISO 8601, never a number of milliseconds. */
const instant = z.iso.datetime();

/** A sentence with no bound the schema can invent; `text` is unbounded in SQL. */
const sentence = z.string().min(1);

/** Minor units of a currency, and a safe integer is the only shape a sum can carry. */
const minorUnits = z.int();

/**
 * A status change on a bill, and the reason that goes with it.
 *
 * The two fields are refined **together** rather than validated independently,
 * because the rule is about the pair: `(status = 'disputed') = (reason is not null)`.
 * Two separate schemas could each hold half the rule and neither could refuse
 * anything, and the column would catch it as a constraint violation instead.
 *
 * `z.strictObject` with `superRefine`, so an unknown key is still an error — the
 * reason `strictObject` matters most is here, where a form that posts both `status`
 * and a typo of `disputeReasons` would otherwise save a `disputed` bill with no
 * reason the operator can see they forgot to type.
 */
export const billPatchSchema = z
  .strictObject({
    status: z.enum(BILL_STATUSES).optional(),
    disputeReason: sentence.nullable().optional(),
  })
  .superRefine((patch, ctx) => {
    // Three cases, and the third is why this is not two.
    //
    // 1. **To `disputed` needs a reason.** In the same body, because the row is not
    //    visible to the schema: a caller that sends `status: "disputed"` on a bill
    //    whose reason is somehow already set is the one case where the column would
    //    accept it and the operator would see a dispute with no explanation.
    if (patch.status === "disputed" && (patch.disputeReason ?? null) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["disputeReason"],
        message: "a disputed bill needs a reason",
      });
      return;
    }

    // 2. **A status other than `disputed` carries no reason** — a sentence, at least.
    //    `null` is the other half of the same rule and is allowed: the column check
    //    `finance_bills_dispute_reason_iff_disputed` says a bill that is not
    //    `disputed` has *no* reason, so `{ status: "issued", disputeReason: null }` is
    //    how a dispute is resolved. Refusing the `null` would leave a disputed bill with
    //    no way out of the dispute standing on it, and the only way past it would be a
    //    row nobody can see the state of. A sentence beside `issued` is the case that
    //    cannot be saved: the column's check refuses it, and here it names the field.
    if (
      patch.status !== undefined &&
      patch.status !== "disputed" &&
      typeof patch.disputeReason === "string"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["disputeReason"],
        message: `a ${patch.status} bill carries no dispute reason`,
      });
      return;
    }

    // 3. **A reason with no status is allowed.** Correcting the wording of a dispute
    //    is a real edit and it does not move the bill, so a body of
    //    `{ disputeReason }` alone must be legal — the row's own status is what says
    //    whether the reason belongs there, and the column check answers that.
  }) satisfies z.ZodType<BillPatch, unknown>;

/**
 * A new credit against a bill.
 *
 * `amountMinor` negative or zero, checked here rather than left to the column so the
 * refusal names the field. `billId` is not checked for existence here: it is a
 * foreign key, and the service already reads the bill to build the response, so the
 * same read answers "is there one" and "what is its ISP" in a single query.
 */
export const creditCreateSchema = z.strictObject({
  id: FINANCE_ID,
  billId: FINANCE_ID,
  amountMinor: minorUnits.max(0),
  basis: z.enum(CREDIT_BASES),
  note: sentence,
  recordedAt: instant,
}) satisfies z.ZodType<CreditCreate, unknown>;

/**
 * A payout's next status, and the reason when it stopped.
 *
 * Refined together for the same reason as the bill's, and with the same
 * three-way reading: to `failed` needs a reason, away from `failed` must clear it,
 * and a patch that mentions neither says nothing and changes nothing.
 */
export const payoutPatchSchema = z
  .strictObject({
    status: z.enum(PAYOUT_STATUSES),
    failureReason: sentence.nullable().optional(),
  })
  .superRefine((patch, ctx) => {
    if (
      patch.status === "failed" &&
      (patch.failureReason === undefined || patch.failureReason === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "a failed payout needs a reason",
      });
    }
    if (
      patch.status !== "failed" &&
      patch.failureReason !== undefined &&
      patch.failureReason !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "only a failed payout carries a failure reason",
      });
    }
  }) satisfies z.ZodType<PayoutPatch, unknown>;

/**
 * A journal entry, and its legs.
 *
 * ## `min(2)` is the whole invariant
 *
 * A journal entry with one posting balances against nothing, and
 * `assertBalanced` in `@hewa/ledger-accounting` refuses it. Refusing it here as a 422
 * naming the field means the caller learns the shape of a journal entry from the
 * schema rather than from a stack.
 *
 * ## The balance is the service's job, not this file's
 *
 * A body can carry legs that do not sum to zero, and it must be able to: the check
 * is one subtraction over the same `Posting` objects `assertBalanced` will be given,
 * performed once in the service where it throws the domain's own error. Duplicating
 * it here would be a second balance rule, and the two would agree about which legs
 * are legal while disagreeing about what to say when they are not.
 */
export const ledgerEntryCreateSchema = z.strictObject({
  id: FINANCE_ID,
  reference: z.string().min(1).max(128),
  description: sentence,
  occurredAt: instant,
  currency: z.enum(CURRENCIES),
  postings: z
    .array(
      z.strictObject({
        accountId: FINANCE_ID,
        amountMinor: minorUnits,
      }),
    )
    .min(2, "a journal entry needs at least two postings"),
}) satisfies z.ZodType<LedgerEntryCreate, unknown>;

/**
 * A published day of a city's revenue.
 *
 * No `publishedAt` in the body, and that is the interesting field here: a row in
 * `finance_attestations` **is** a published attestation, so its publication time is
 * when the service accepted it. A body that could set it could backdate a signature —
 * and the panel's "published 6am" column would then be a field anybody with the write
 * token could choose.
 *
 * No `netRevenue` either, for the reason `finance_bills` has no `net_total_minor`:
 * it is `gross - costs` and the mapper does it.
 */
export const attestationCreateSchema = z.strictObject({
  id: FINANCE_ID,
  city: z.string().min(1).max(96),
  month: MONTH,
  day: DAY,
  currency: z.enum(CURRENCIES),
  grossMinor: minorUnits.min(0),
  costsMinor: minorUnits.min(0),
}) satisfies z.ZodType<AttestationCreate, unknown>;

/**
 * Every finance schema, by resource.
 *
 * A record rather than six imported names, so the controller cannot bind the wrong
 * schema to a route: `FINANCE_WRITE_SCHEMAS[this.service.RESOURCE]` and a resource
 * whose schemas were never added is a compile error at the binding rather than a 422
 * on a body that was perfectly fine.
 */
export const FINANCE_WRITE_SCHEMAS = {
  bills: { patch: billPatchSchema },
  credits: { create: creditCreateSchema },
  payouts: { patch: payoutPatchSchema },
  ledger_entries: { create: ledgerEntryCreateSchema },
  attestations: { create: attestationCreateSchema },
} as const;
