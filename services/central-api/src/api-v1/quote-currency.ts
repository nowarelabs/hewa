/**
 * One currency per quote, checked in one place.
 *
 * Both the order book and the price series are quoted in a single currency, and
 * `market.service.ts` refuses to answer a payload that mixes them: a book whose best
 * bid is USDC and whose lowest offer is USD has no spread to speak of, and a chart
 * drawing two currencies on one axis is not a chart. That refusal is a *read*
 * invariant, and it is worth having.
 *
 * It is also the invariant a write would otherwise break. The refusal costs one
 * query and no state, so anybody may write an order in the wrong currency — and the
 * next read of the whole market view answers 422 for every operator on the console,
 * because of one field in one row. A write path that can take a read path down is
 * not a write path; so the writer asks first.
 *
 * The check lives here, beside neither caller, because a rule stated in the read
 * path and restated in the write path is two rules that stop agreeing — and the
 * disagreement shows up as a market view that 422s on data the console itself
 * accepted.
 */
import { ValidationError } from "@hewa/errors";
import type { Currency } from "@hewa/marketplace-types";

/**
 * The currency an empty quote is shown in.
 *
 * `USD`, from `CURRENCIES` in `@hewa/marketplace-types`, where it is described as the
 * marketplace's unit of account. The only place the payload names a currency no row
 * states, and it is reachable only where there are no rows — beside a count of zero
 * and nothing else. The alternative is making `currency` nullable to avoid naming a
 * unit of account, and a panel rendering "no currency" for an empty market is a worse
 * answer.
 */
export const UNIT_OF_ACCOUNT: Currency = "USD";

/** What the two callers call the thing they are checking. */
export type QuoteSubject = "order book" | "price history";

/**
 * The one currency a quote is in, refusing a payload that is not one.
 *
 * Takes rows rather than a set of currencies because both callers have rows: the read
 * paths have the ones they are about to answer, and the write paths have the distinct
 * currencies already stored.
 */
export function quoteCurrency(
  rows: readonly { currency: Currency }[],
  subject: QuoteSubject,
): Currency {
  const currencies = [...new Set(rows.map((row) => row.currency))];
  if (currencies.length > 1) {
    throw new ValidationError(`The ${subject} is quoted in more than one currency`, {
      currencies,
    });
  }
  return currencies[0] ?? UNIT_OF_ACCOUNT;
}

/**
 * Refuse a write that would put a second currency on a quote.
 *
 * Called before the statement, on the currencies already stored, with the one the
 * write would add. An empty table is always allowed: the first row establishes the
 * unit of account rather than disagreeing with it, which is why the emptiness check
 * comes before the comparison and not after it.
 *
 * The answer is a `ValidationError` — a 422 — because the request was well-formed
 * and the *content* is what conflicts. The details name both currencies, so an
 * editor can say which one the book already uses rather than "invalid currency".
 */
export function assertQuoteCurrency(
  stored: readonly { currency: Currency }[],
  incoming: Currency,
  subject: QuoteSubject,
): void {
  if (stored.length === 0) {
    return;
  }
  const current = quoteCurrency(stored, subject);
  if (current !== incoming) {
    throw new ValidationError(`The ${subject} is quoted in ${current}`, {
      quoted: current,
      received: incoming,
    });
  }
}
