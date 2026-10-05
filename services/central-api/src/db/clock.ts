/**
 * The clock a service reads "now" from.
 *
 * ## Why this is a provider and not `new Date()`
 *
 * Because one section in this service is a function of the current date.
 * `revenue/receivables` ages every bill against today, so the same row is `current`
 * in one month and `d90_plus` five weeks later — which is correct, and which makes
 * the section untestable against a fixture: a test that asserts "there is a
 * receivable in every ageing bucket" passes on the day it was written and fails six
 * weeks later for no reason connected to the code.
 *
 * Overriding one provider in `tests/boot.ts` fixes that the same way the `DB`
 * override fixes the database: the module graph, the guards and the rest stay
 * production's own, and the suite supplies only the two things it must control — the
 * connection and the date. Everything else is resolved exactly as it is deployed.
 *
 * `() => Date` rather than an object with `now()`, because the whole use is a single
 * call and a method on an interface is one more thing to implement in a stub.
 */
export const CLOCK = Symbol("CLOCK");

/** The current instant. */
export type Clock = () => Date;

/** The provider a deployment gets: the wall clock. */
export const systemClock: Clock = () => new Date();

/**
 * Whole days from `from` to `to`, negative when `to` is earlier.
 *
 * Truncated rather than rounded, and the direction matters: a bill due at 09:00 that
 * is read at 11:00 the same day is zero days overdue, not one, and rounding would put
 * it in tomorrow's bucket for half of every day. A whole number of days is also what
 * makes the ageing buckets line up with the calendar an operator reads a statement
 * against.
 *
 * By UTC rather than by the server's zone, because a bucket boundary that moves when
 * somebody travels is a bucket that disagrees with itself between two readers of the
 * same figure.
 */
export function daysBetween(from: Date, to: Date): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.trunc((to.getTime() - from.getTime()) / day);
}
