import { ValidationError } from "@hewa/errors";

/**
 * The service level an ISP commits to and a supplier offers.
 *
 * Percentages are stored as fractions of 1, not as `99.5`. A percentage invites
 * the `0.995` vs `99.5` bug, and the SLA comparison is the single number a
 * dispute turns on.
 */
export interface SlaCommitment {
  /** Availability the counterparty is entitled to expect, e.g. 0.995. */
  readonly target: number;
  /** Availability actually delivered over the period, e.g. 0.98. */
  readonly actual: number;
  /** Credit as a fraction of the monthly charge, per full point of shortfall. */
  readonly creditRatePerPoint: number;
}

export function slaCommitment(
  target: number,
  actual: number,
  creditRatePerPoint: number,
): SlaCommitment {
  return assertSlaCommitment({ target, actual, creditRatePerPoint });
}

export function assertSlaCommitment(value: SlaCommitment): SlaCommitment {
  if (value.target < 0 || value.target > 1) {
    throw new ValidationError("SLA target must be a fraction between 0 and 1", {
      received: value.target,
    });
  }
  if (value.actual < 0 || value.actual > 1) {
    throw new ValidationError("SLA actual must be a fraction between 0 and 1", {
      received: value.actual,
    });
  }
  if (value.creditRatePerPoint < 0) {
    throw new ValidationError("SLA credit rate cannot be negative", {
      received: value.creditRatePerPoint,
    });
  }
  return value;
}

/** True when delivery fell short of the committed target. */
export function hasSlaBreach(sla: SlaCommitment): boolean {
  return sla.actual < sla.target;
}

/**
 * How far delivery missed, in whole percentage points.
 *
 * A 99.5% target against 98.2% actual is 1.3 points, which bills as 1 full
 * point plus a 0.3 remainder. Returns 0 when there is no breach, so callers
 * never have to special-case compliance.
 */
export function slaShortfallPoints(sla: SlaCommitment): number {
  if (!hasSlaBreach(sla)) return 0;
  return (sla.target - sla.actual) * 100;
}

/**
 * Tolerance applied before the shortfall is floored to a whole point.
 *
 * `0.9` has no exact binary representation, so a 10-point shortfall evaluates
 * as `(1 - 0.9) * 100 === 9.999999999999998`. Flooring that reports 9, which
 * understates the credit on precisely the clean whole-number shortfalls an ISP
 * is most likely to audit. The epsilon is seven orders of magnitude below the
 * one-point granularity and four above the representation error, so it changes
 * the verdict only where the true shortfall is a whole number.
 */
const POINT_EPSILON = 1e-9;

/** The whole percentage points a credit is charged on. */
export function creditablePoints(sla: SlaCommitment): number {
  return Math.floor(slaShortfallPoints(sla) + POINT_EPSILON);
}
