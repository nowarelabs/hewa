import { ValidationError } from "@hewa/errors";

/**
 * The service level an ISP commits to and a supplier offers.
 *
 * Availability is held in **basis points** — hundredths of a percentage point —
 * rather than as a fraction of 1. `9995` means 99.95%, and nothing in this type
 * is a `float`.
 *
 * A fraction was the earlier representation and it was wrong for this job. The
 * shortfall is compared against a whole-point boundary, and `(1 - 0.9) * 100`
 * evaluates to `9.999999999999998`, so a clean ten-point miss reads as nine. The
 * fix was an epsilon, and an epsilon is a fudge factor that hides the next
 * boundary bug instead of removing one. Basis points remove the class of bug: the
 * subtraction is integer, the division is exact whenever the result is a whole
 * point, and there is no rounding decision left to get wrong.
 *
 * `0.9995` is also a shape no SLA table should have. Availability commitments
 * are quoted in basis points by every carrier, and a counterparty comparing
 * tables should not have to guess which representation a column is in.
 */
export interface SlaCommitment {
  /** Committed availability in basis points, 0 to 10_000. 9995 is 99.95%. */
  readonly targetBps: number;
  /** Delivered availability in basis points, 0 to 10_000. 9975 is 99.75%. */
  readonly actualBps: number;
  /**
   * Credit per whole point of shortfall, as an exact fraction of the charge.
   * `1 / 20` is 5% of the charge per point.
   *
   * A ratio rather than a float percentage, so a credit is always recomputable
   * to the cent by whoever is disputing it.
   */
  readonly creditNumerator: number;
  readonly creditDenominator: number;
}

/** Basis points in one percent: 100 bps is one percentage point. */
export const BPS_PER_PERCENT = 100;

/** Ten thousand basis points is 100%. */
export const MAX_BPS = 10_000;

export function slaCommitment(
  targetBps: number,
  actualBps: number,
  creditNumerator: number,
  creditDenominator: number,
): SlaCommitment {
  return assertSlaCommitment({ targetBps, actualBps, creditNumerator, creditDenominator });
}

function assertBps(value: number, field: string): void {
  // `Number.isInteger` rather than a range check alone, because 9995.5 is inside
  // the range and is not a representable availability.
  if (!Number.isInteger(value) || value < 0 || value > MAX_BPS) {
    throw new ValidationError(
      `${field} must be a whole number of basis points between 0 and ${MAX_BPS}`,
      { received: String(value) },
    );
  }
}

export function assertSlaCommitment(value: SlaCommitment): SlaCommitment {
  assertBps(value.targetBps, "SLA target");
  assertBps(value.actualBps, "SLA actual");
  if (!Number.isInteger(value.creditNumerator) || value.creditNumerator < 0) {
    throw new ValidationError("SLA credit numerator must be a non-negative integer", {
      received: String(value.creditNumerator),
    });
  }
  if (!Number.isInteger(value.creditDenominator) || value.creditDenominator <= 0) {
    // A zero denominator is a rate card that cannot be priced, and a negative
    // one is a credit that pays the ISP.
    throw new ValidationError("SLA credit denominator must be a positive integer", {
      received: String(value.creditDenominator),
    });
  }
  return value;
}

/** True when delivery fell short of the committed target. */
export function hasSlaBreach(sla: SlaCommitment): boolean {
  return sla.actualBps < sla.targetBps;
}

/**
 * How far delivery missed, in basis points.
 *
 * Integer subtraction, so there is no representation error to reason about.
 * A 99.95% target against 98.20% actual is 175 bps, exactly.
 */
export function slaShortfallBps(sla: SlaCommitment): number {
  if (!hasSlaBreach(sla)) return 0;
  return sla.targetBps - sla.actualBps;
}

/**
 * The whole percentage points a credit is charged on.
 *
 * `Math.floor` of an exact integer division. When the shortfall is a whole
 * number of points the division lands on an exactly representable integer, and
 * when it does not, the floor is the intended truncation. There is no case where
 * a value just short of a whole point rounds across the boundary, because the
 * input is an integer count of bps rather than a subtraction of fractions.
 */
export function creditablePoints(sla: SlaCommitment): number {
  return Math.floor(slaShortfallBps(sla) / BPS_PER_PERCENT);
}

/** Format bps as the percentage a human reads, e.g. 9995 becomes `99.95%`. */
export function formatBps(bps: number): string {
  assertBps(bps, "Availability");
  const whole = Math.floor(bps / BPS_PER_PERCENT);
  const remainder = bps % BPS_PER_PERCENT;
  return `${whole}.${String(remainder).padStart(2, "0")}%`;
}

/**
 * The three states a monitored SLA can be in, and the vocabulary for all of them.
 *
 * This is a list rather than a pair of booleans because it is a *vocabulary*: a
 * filter bar builds one chip per entry, including the entries nothing is on. The
 * console's `meta.groups` is handed this list, so a state with no rows this week
 * still has a chip an operator can press.
 */
export const SLA_STATES = ["compliant", "at_risk", "breached"] as const;

export type SlaState = (typeof SLA_STATES)[number];

/**
 * How each state is written where a human reads it.
 *
 * Beside the list rather than in the panel, keyed by the **value** a row carries
 * rather than by the member name, so `at_risk` is "At risk" and a panel does not
 * have to hold a second copy of the vocabulary to render a chip.
 */
export const SLA_STATE_TITLES: Readonly<Record<SlaState, string>> = {
  compliant: "Compliant",
  at_risk: "At risk",
  breached: "Breached",
};

const SLA_STATE_SET: ReadonlySet<string> = new Set(SLA_STATES);

export function isSlaState(value: unknown): value is SlaState {
  return typeof value === "string" && SLA_STATE_SET.has(value);
}

/**
 * How close to the target counts as at risk rather than breached.
 *
 * One percentage point, in basis points so the comparison stays integer. This is
 * the threshold that decides whether a shortfall is a warning or an invoice, so
 * it is named and exported rather than written into the comparison — a number
 * typed inline is a number the next reader has to guess at.
 */
export const AT_RISK_BPS = BPS_PER_PERCENT;

/**
 * Classify a commitment as compliant, at risk, or breached.
 *
 * Derived here and nowhere else. The alternative was each surface deciding for
 * itself, and the failure mode is quiet and expensive: an operations console
 * counts its breach chips with one rule and a settlement run issues credits with
 * another, so a commitment is "breached" on screen and not on the bill. One
 * function, one definition of the boundary, and the service stores its answer so
 * a record and the panel that draws it cannot disagree.
 *
 * Integer comparison throughout — {@link slaShortfallBps} is a subtraction of two
 * whole basis-point counts — so the boundary lands exactly on
 * `AT_RISK_BPS` rather than near it.
 */
export function slaState(sla: SlaCommitment): SlaState {
  const shortfall = slaShortfallBps(sla);
  if (shortfall === 0) {
    return "compliant";
  }
  if (shortfall < AT_RISK_BPS) {
    return "at_risk";
  }
  return "breached";
}
