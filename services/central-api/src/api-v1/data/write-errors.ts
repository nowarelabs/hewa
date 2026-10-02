/**
 * What a refused write says.
 *
 * A write reaches the database and can be refused by the database, for four
 * reasons that are all *correct* refusals and none of which is a bug in this
 * process:
 *
 * - the row is already there (`23505`, unique violation) — a create whose id is
 *   taken, or a spot whose `(pool, observedAt)` pair has been observed before;
 * - a check constraint says the value is out of range (`23514`) — the burst below
 *   the committed capacity, or a patch that sets a basis-point figure past its
 *   bound against a stored row the schema never saw;
 * - a foreign key has nothing to point at (`23503`) — a monitor naming a node that
 *   does not exist;
 * - a not-null column received nothing (`23502`) — which a schema that marks every
 *   field required cannot produce, and which is listed because "no row matched"
 *   must not be the answer for every one of these.
 *
 * Left alone, PostgreSQL's error reaches the exception filter as something that is
 * not an `AppError`, and `toAppError` opaques it into a 500. That is a lie in the
 * direction that costs the most: an operator saves an order whose burst is below
 * its committed capacity, sees "internal error", and has no way to tell a rejected
 * write from a broken service.
 *
 * So each is translated into the workspace's own error, here, once. `ConflictError`
 * for the duplicate and `ValidationError` for the rest, because in both cases the
 * request was well-formed and the *content* is what was refused.
 *
 * The constraint's name is carried in `details`, and the driver message is not:
 * `23514` on `market_orders_burst_gte_committed` says exactly which rule fired and
 * the column's own text says what it wants, and a client's message is built from
 * the name rather than parsed out of prose. Nothing from the driver's own message
 * is forwarded anywhere, since it quotes the values that failed.
 */
import { ConflictError, ValidationError } from "@hewa/errors";

/** The PostgreSQL `errcode` values this file translates. */
const SQLSTATE = {
  uniqueViolation: "23505",
  checkViolation: "23514",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
} as const;

/**
 * Walk out of whatever the ORM threw, to the error the driver threw.
 *
 * Drizzle does not let the driver's error out: a failed statement arrives as a
 * `DrizzleQueryError` whose own `code` is undefined and whose `cause` is the
 * `PostgresError` carrying the `errcode` and the constraint name. Reading `code` off
 * the wrapper alone therefore finds nothing, every constraint answers 500, and the
 * translation below looks correct while never once running — a failure that is
 * invisible in review and only shows up as an operator's save failing.
 *
 * So the chain is followed to its end, and each hop is read defensively rather than
 * with an `instanceof`: node-postgres throws its own error class, PGlite throws
 * `PostgresError`, and one service runs its suite against the second and its
 * production against the first. The difference between them is exactly why nothing
 * here names a class.
 *
 * Bounded, because a cause chain is arbitrary data and this runs on the failure
 * path of a request: four hops is deeper than any driver nests.
 */
function driverError(error: unknown): unknown {
  let current = error;

  for (let hop = 0; hop < 4; hop++) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") {
      return record;
    }
    if (typeof record.cause !== "object" || record.cause === null) {
      return undefined;
    }
    current = record.cause;
  }

  return undefined;
}

/**
 * The `errcode`, read off the driver's own error.
 *
 * Both drivers put it on `code` — node-postgres on its error class, PGlite on
 * `PostgresError` — and it is a five-character string the driver defines, which is
 * what makes matching on the literal safe here rather than at every call site.
 */
function sqlStateOf(error: unknown): string | undefined {
  const driver = driverError(error);
  return typeof driver === "object" && driver !== null
    ? ((driver as { code?: unknown }).code as string | undefined)
    : undefined;
}

/**
 * The constraint's name, when the driver reported one.
 *
 * Only `constraint` is read, and only to be reported back: it is an identifier this
 * schema defines, so it cannot carry caller data.
 */
function constraintOf(error: unknown): string | undefined {
  const driver = driverError(error);
  if (typeof driver !== "object" || driver === null) {
    return undefined;
  }
  const constraint = (driver as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : undefined;
}

/**
 * Run a write statement, translating a database refusal.
 *
 * The one wrapper every service's statements go through, so a constraint violated
 * anywhere answers the same way. The alternative — each service catching around
 * its own statements — is six four-line `try` blocks that look like plumbing, which
 * is exactly the shape of code whose seventh copy is missing.
 */
async function write<T>(resource: string, statement: () => Promise<T>): Promise<T> {
  try {
    return await statement();
  } catch (error) {
    translateWriteRefusal(error, resource);
  }
}

export { write };

/**
 * Throw the translated error, or re-throw what arrived.
 *
 * `catch` and re-throw rather than a `try` at every call site, because a service
 * that forgot the catch would answer 500 to an operator's save and the forgetting
 * would be invisible in review — the `try` is four lines that look like plumbing.
 *
 * `write` is re-thrown unchanged when the failure is not one of the four states
 * above — an `AppError` raised above the database, or a genuine fault — because
 * this function knows how to translate a *constraint* and nothing else.
 */
export function translateWriteRefusal(error: unknown, resource: string): never {
  const state = sqlStateOf(error);
  const constraint = constraintOf(error);

  const details = { resource, ...(constraint === undefined ? {} : { constraint }) };

  switch (state) {
    case SQLSTATE.uniqueViolation:
      throw new ConflictError(`${resource} already exists`, details);
    case SQLSTATE.checkViolation:
      throw new ValidationError(`${resource} was refused by a column constraint`, details);
    case SQLSTATE.foreignKeyViolation:
      throw new ValidationError(`${resource} refers to a row that does not exist`, details);
    case SQLSTATE.notNullViolation:
      throw new ValidationError(`${resource} is missing a required column`, details);
    default:
      throw error;
  }
}
