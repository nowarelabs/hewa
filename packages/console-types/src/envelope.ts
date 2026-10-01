import type { ResponseCode } from "@hewa/response-codes";

/**
 * The console's wire contract: one envelope for every section of every view.
 *
 * A response is `{ code, data, meta }`. The `code` is the shared
 * {@link ResponseCode} every surface in this workspace already answers with, so a
 * consumer switches on the same string whether the response came from a Nest
 * service, a Hono process, or a Next route handler. The `data` is the rows.
 * The `meta` is the part that is not rows.
 *
 * What is inside `data` is per section and lives in `sections.ts`, beside the list
 * of sections it belongs to.
 */

/**
 * What a section knows that is not one of its rows.
 *
 * A named object with one field rather than a bare array, because a section that
 * later needs a total, a cursor or a generated-at stamp adds a key here instead of
 * changing the shape the `data` sits in. That is the whole reason `meta` is an
 * object: a response whose non-row half is a bare value has no room to grow.
 */
export interface ConsoleMeta<TGroup extends string> {
  /**
   * Every group this section can hold, including groups no row currently does.
   *
   * This is a vocabulary, not a count, and it is why it travels with the rows
   * rather than beside them. A summary bar builds a chip per group out of the
   * groups, so a group with nothing in it still gets a chip at zero — and an
   * operator can press it. Derived from the rows alone, a filter chip appears and
   * disappears as the data moves, which is a control that is only sometimes there.
   *
   * Anything found in `data` is counted whether or not it is named here, so this
   * can add groups but can never hide one.
   *
   * Narrowing happens *inside* a section, not between sections: the rail has
   * already chosen the question, and this is what narrows its answer.
   */
  readonly groups: TGroup[];
}

export interface ConsoleEnvelope<TData, TGroup extends string = never> {
  readonly code: ResponseCode;
  readonly data: TData;
  readonly meta: ConsoleMeta<TGroup>;
}

/**
 * The five views, in the order the console's tab strip shows them.
 *
 * The runtime list is hand-written and the payload map in `sections.ts` is the
 * type, so the two can drift — a view named here with no sections is a tab with an
 * empty rail. What closes that gap is on the app side: `tests/data.test.ts`
 * asserts this list is the shell config's `views` keys, and the service's e2e test
 * walks the section list rather than this one.
 */
export const CONSOLE_VIEWS = ["market", "infrastructure", "settlement", "slas", "alerts"] as const;

export type ConsoleViewKey = (typeof CONSOLE_VIEWS)[number];
