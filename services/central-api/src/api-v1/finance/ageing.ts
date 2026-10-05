import type { ReceivableBucket } from "@hewa/financial-dashboard-types";

/**
 * Which ageing bucket a number of days overdue falls in.
 *
 * ## Why the boundary is written out rather than looked up
 *
 * Four edges and one floor, and a lookup table would be four edges and a floor too —
 * the difference is that a table has to be kept in step with the names in
 * `RECEIVABLE_BUCKETS`, and this function cannot be. There is nothing here to
 * rename when a bucket is renamed, because the function returns the vocabulary's own
 * union and TypeScript fails on a member that is not in it.
 *
 * ## Where the boundaries are, and why they are these numbers
 *
 * 30 / 60 / 90 days. Those are the intervals a collections process is written
 * against — a reminder at thirty, an escalation at sixty, a write-off conversation at
 * ninety — so the buckets are the ones an operator already has a name for. A bucket
 * boundary chosen because it divides the range evenly would be tidier and would put
 * the 45-day-old bill in a bucket nobody has a policy for.
 *
 * `current` first, and it is the only bucket that includes a negative number: a bill
 * due in ten days is not thirty days overdue in the other direction, and a
 * collections view that listed it under `d1_30` because the arithmetic was symmetric
 * would be counting arrears as though they existed.
 *
 * Exported rather than private because the e2e suite pins the boundaries from the
 * other side — it reads the five buckets out of this function rather than asserting
 * a hand-written expectation, so the test and the section cannot disagree about what
 * day 45 means.
 */
export function receivableBucket(daysOverdue: number): ReceivableBucket {
  if (daysOverdue <= 0) {
    return "current";
  }
  if (daysOverdue <= 30) {
    return "d1_30";
  }
  if (daysOverdue <= 60) {
    return "d31_60";
  }
  if (daysOverdue <= 90) {
    return "d61_90";
  }
  return "d90_plus";
}
