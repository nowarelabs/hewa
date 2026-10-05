import type {
  Bill,
  BillStatus,
  CreditBasis,
  CreditRecord,
  Receivable,
  ReceivableBucket,
} from "./billing.js";
import { FINANCE_VIEWS, type FinanceEnvelope, type FinanceViewKey } from "./envelope.js";
import type { AccountType, LedgerAccount, LedgerSection } from "./ledger.js";
import type { PayoutRecord, PayoutStatus } from "./payouts.js";
import type { AttestationRecord, AttestationVerdict } from "./proof.js";

/**
 * The dashboard's sections: which ones exist, what each is called, and what each
 * answers with.
 *
 * The envelope every one of them travels in is declared in `envelope.ts`; this file
 * is the navigation.
 *
 * ## A rail button is a destination, not a filter
 *
 * Every section below is a question with its own answer: its own endpoint, its own
 * rows, its own main column and its own right column. The rails used to be built out
 * of each section's group vocabulary — `disputed`, `d90_plus` — which is a second
 * way of doing what the summary bar's chips already do, over the same rows, from the
 * same single endpoint. It looks like navigation and behaves like a filter, and an
 * operator reading a rail of bill states reasonably concludes "disputed" is a
 * *place* rather than a *predicate*.
 *
 * ## The pair that is one question, asked twice
 *
 * `revenue/bills` and `revenue/receivables` read the same table, and that is the
 * only place two sections share a source. They are still two sections because the
 * two questions differ: bills are *what was issued* — every bill, including the paid
 * and voided ones — and receivables are *what is still owed*, which is the same rows
 * filtered by the settlement against them and with ageing computed on top. One of
 * them answers "issue this invoice", the other answers "who do we chase", and an
 * operator who had to guess which tab holds the row they were looking at would be
 * reading a navigation that lies.
 */
export const FINANCE_SECTIONS = {
  revenue: ["bills", "receivables", "credits"] as const,
  settlement: ["payouts"] as const,
  ledger: ["ledger"] as const,
  proof: ["attestations"] as const,
} as const;

export type FinanceSectionId<V extends FinanceViewKey> = (typeof FINANCE_SECTIONS)[V][number];

export type FinanceSectionKey = {
  [V in FinanceViewKey]: `${V}/${FinanceSectionId<V>}`;
}[FinanceViewKey];

export const FINANCE_SECTION_KEYS: readonly FinanceSectionKey[] = FINANCE_VIEWS.flatMap((view) =>
  FINANCE_SECTIONS[view].map((section) => `${view}/${section}` as FinanceSectionKey),
);

export const SECTION_TITLES: Readonly<Record<FinanceSectionKey, string>> = {
  "revenue/bills": "Bills",
  "revenue/receivables": "Receivables",
  "revenue/credits": "Credits",
  "settlement/payouts": "Payouts",
  // Not "Ledger": the view's own tab already reads Ledger, and a section titled the
  // same prints the word twice. The section is the accounts — one row each, with the
  // balance it carries — which is the part an operator navigates to.
  "ledger/ledger": "Accounts",
  "proof/attestations": "Attestations",
};

export function financeSectionPath<V extends FinanceViewKey>(
  view: V,
  section: FinanceSectionId<V>,
): string {
  return `/api/v1/finance/${view}/${section}`;
}

/**
 * Every section's read path, keyed by section key.
 *
 * `financeSectionPath` takes the view and the section as two arguments because a
 * service controller is handed them as two arguments. A client holds *one*
 * `FinanceSectionKey`, and the obvious thing to do with it — split on the slash and
 * call the path function — does not type check, because nothing in the type system
 * says that `revenue` cannot be paired with `payouts`. It is a 404, written once per
 * client as a cast.
 *
 * So the map is here, beside the keys it is keyed by, and `financeSectionPath` stays
 * the one place a path is built: every value below is that function's output, and
 * `tests/contract.test.ts` walks the section registry asserting it. Written by hand
 * because an object literal is the only way to hold six correlated pairs without a
 * cast — a `Record` annotation on this fails to compile until all six keys are here,
 * which is the intended way to find out a seventh section was added.
 */
export const FINANCE_SECTION_ENDPOINTS: Readonly<Record<FinanceSectionKey, string>> = {
  "revenue/bills": financeSectionPath("revenue", "bills"),
  "revenue/receivables": financeSectionPath("revenue", "receivables"),
  "revenue/credits": financeSectionPath("revenue", "credits"),
  "settlement/payouts": financeSectionPath("settlement", "payouts"),
  "ledger/ledger": financeSectionPath("ledger", "ledger"),
  "proof/attestations": financeSectionPath("proof", "attestations"),
};

export function parseSectionKey(key: FinanceSectionKey): {
  view: FinanceViewKey;
  section: string;
} {
  const [view, section] = key.split("/");
  return { view: view as FinanceViewKey, section: section ?? "" };
}

/**
 * The payload map: what each section's endpoint answers with.
 *
 * The generic return type on a controller is `FinancePayload["revenue/bills"]`, so a
 * field renamed in the contract fails the build in the service that fills it rather
 * than arriving as `undefined` in a panel.
 */
export interface FinancePayload {
  // revenue
  "revenue/bills": FinanceEnvelope<Bill[], BillStatus>;
  "revenue/receivables": FinanceEnvelope<Receivable[], ReceivableBucket>;
  "revenue/credits": FinanceEnvelope<CreditRecord[], CreditBasis>;

  // settlement
  "settlement/payouts": FinanceEnvelope<PayoutRecord[], PayoutStatus>;

  // ledger
  // The one section whose data is not a list: the chart *and* the entries posted
  // against it, because a posting cannot be read without the account it moved.
  "ledger/ledger": FinanceEnvelope<LedgerSection, AccountType>;

  // proof
  "proof/attestations": FinanceEnvelope<AttestationRecord[], AttestationVerdict>;
}

export type FinanceData<K extends FinanceSectionKey> = FinancePayload[K]["data"];
export type FinanceGroups<K extends FinanceSectionKey> = FinancePayload[K]["meta"]["groups"];

/**
 * The row type each section draws.
 *
 * Named here because the panel needs it and because a section whose row type is
 * `FinancePayload[K]["data"][number]` only works while `K` is the literal key — the
 * panel holds the widened `K`, and a widened `K` gives `never`. This map is the
 * narrowing the panel actually has.
 */
export interface FinanceSectionRows {
  readonly "revenue/bills": Bill;
  readonly "revenue/receivables": Receivable;
  readonly "revenue/credits": CreditRecord;
  readonly "settlement/payouts": PayoutRecord;
  readonly "ledger/ledger": LedgerAccount;
  readonly "proof/attestations": AttestationRecord;
}

/**
 * The group vocabulary each section filters on, at runtime.
 *
 * The service builds `meta.groups` from its own `pgEnum` definitions rather than
 * from this file, and `tests/vocabularies.test.ts` asserts the two lists are equal.
 * The enum is the source of truth for what the **database** can hold; this map is
 * what the **panel** offers a chip for, and a chip for a value no row can hold is a
 * control that filters to nothing.
 *
 * `PayoutMethod` is in the payouts vocabulary and not in the section's group, on
 * purpose: `meta.groups` is one axis, and a section with two would be the count and
 * the filter disagreeing again. `method` is a column on the row instead.
 */
export interface FinanceSectionGroupVocabulary {
  readonly "revenue/bills": readonly BillStatus[];
  readonly "revenue/receivables": readonly ReceivableBucket[];
  readonly "revenue/credits": readonly CreditBasis[];
  readonly "settlement/payouts": readonly PayoutStatus[];
  readonly "ledger/ledger": readonly AccountType[];
  readonly "proof/attestations": readonly AttestationVerdict[];
}

/** A section key whose groups are known to be a runtime list rather than `never`. */
export type FinanceGroupedSectionKey = keyof FinanceSectionGroupVocabulary;
