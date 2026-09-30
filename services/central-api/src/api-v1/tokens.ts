/**
 * The injection token for the configured service token.
 *
 * In its own file, and that is the whole reason it is a file: the guard needs the
 * token and the module that provides the guard needs the guard, so a token
 * exported from the module would make those two imports circular. Nest reports
 * that as a circular dependency in the module graph rather than as the import
 * cycle it is, which is a confusing thing to go looking for.
 *
 * A `Symbol` rather than a class for the usual reasons: a class would have to be
 * imported by whatever injects it, and a plain symbol cannot be constructed by
 * accident from a stale import. A missing binding then fails at resolution, which
 * is what a missing token should do, rather than producing an empty string to
 * compare every request against.
 */
export const SERVICE_TOKEN = Symbol("SERVICE_TOKEN");
