/**
 * An instant out of a query that aggregated over a timestamp column.
 *
 * `select()` knows a column's type from the schema and hands back a `Date`. An
 * aggregate does not: `min(raised_at)` is a bare `sql` fragment with no column
 * behind it, so both drivers hand back whatever the wire carried — a `Date` from
 * node-postgres and a string from PGlite, and a string in both once the fragment is
 * wrapped in anything that loses the type.
 *
 * That difference is the whole reason this function exists. `row.lastSeenAt
 * .toISOString()` compiles, passes against real PostgreSQL, and then throws
 * `toISOString is not a function` in the test suite against PGlite — a section
 * that 500s in tests and works in the one environment nobody watches. Reading the
 * value and formatting it here means the code below never asks what it got.
 *
 * Accepting `Date | string` is honest about that split rather than pretending the
 * driver is consistent: it says the value's type depends on where it came from,
 * which is true, and puts the one conversion in one place.
 */
export function instant(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
