import type { ResponseCode } from "@hewa/response-codes";

/**
 * The financial dashboard's wire contract: one envelope for every section of every
 * view.
 *
 * Identical in shape to `@hewa/console-types`, and deliberately not shared with
 * it. A second dashboard is a second consumer with its own questions, and the
 * honest way to keep two contracts from drifting into one is to let them be two
 * files until there is a third reader that wants both — at which point the
 * envelope is the thing that moves, and the records are what is left behind.
 *
 * What the envelope carries, and why each part is here:
 *
 * - `code` is the shared {@link ResponseCode} every surface in this workspace
 *   answers with, so a consumer switches on the same string whether the response
 *   came from a Nest service, a Hono process or a Next route handler.
 * - `data` is the rows, in the shape that section's panel draws.
 * - `meta` is what a section knows that is not one of its rows, which today is the
 *   group vocabulary.
 */

/**
 * What a section knows that is not one of its rows.
 *
 * A named object with one field rather than a bare array, because a section that
 * later needs a total, a cursor or a generated-at stamp adds a key here instead of
 * changing the shape the `data` sits in. That is the whole reason `meta` is an
 * object: a response whose non-row half is a bare value has no room to grow.
 */
export interface FinanceMeta<TGroup extends string> {
  /**
   * Every group this section can hold, including groups no row currently does.
   *
   * A vocabulary, not a count, and that is why it travels with the rows rather than
   * beside them. A summary bar builds a chip per group out of the groups, so a
   * group with nothing in it still gets a chip at zero — and an operator can press
   * it. Derived from the rows alone, a filter chip appears and disappears as the
   * data moves, which is a control that is only sometimes there.
   *
   * Anything found in `data` is counted whether or not it is named here, so this
   * can add groups but can never hide one.
   *
   * Narrowing happens *inside* a section, not between sections: the rail has
   * already chosen the question, and this is what narrows its answer.
   *
   * `readonly` on the array and not only on the property, because every vocabulary in
   * this workspace is a `const` tuple — `BILL_STATUSES`, `ACCOUNT_TYPES`,
   * `PAYOUT_STATUSES` — and those are readonly tuples. A mutable element type made each
   * producer either copy its own vocabulary into a fresh array or cast one across, and
   * the cast is where a section's groups could end up being a list the producer is free
   * to change after the payload is built. The vocabulary is fixed when the enum is.
   */
  readonly groups: readonly TGroup[];
}

export interface FinanceEnvelope<TData, TGroup extends string = never> {
  readonly code: ResponseCode;
  readonly data: TData;
  readonly meta: FinanceMeta<TGroup>;
}

/**
 * The four views, in the order the dashboard's tab strip shows them.
 *
 * Four views over six sections, and the grouping is the part worth arguing about:
 * a tab is a question, so `revenue` is "what did we bill and what is still owed"
 * while `ledger` is "does the book balance" — and those are different questions
 * with different answers even on a day when both happen to agree. Six tabs would
 * make `bills` and `receivables` siblings, and they are the same money seen from
 * two ends: a bill that is unpaid *is* a receivable, and an operator who has to
 * learn which of the two tabs holds the row they are looking at has been given two
 * places to look for one fact.
 *
 * The runtime list is hand-written and the payload map in `sections.ts` is the
 * type, so the two can drift — a view named here with no sections is a tab with an
 * empty rail. What closes that gap is on the app side: `tests/data.test.ts`
 * asserts this list is the shell config's `views` keys, and the service's e2e test
 * walks the section list rather than this one.
 */
export const FINANCE_VIEWS = ["revenue", "settlement", "ledger", "proof"] as const;

export type FinanceViewKey = (typeof FINANCE_VIEWS)[number];
