import { Global, Module } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { loadEnv } from "../config/env.js";
import { CLOCK, systemClock } from "./clock.js";
import * as schema from "./schema.js";

/**
 * The injection token the pool is provided under.
 *
 * A `Symbol` rather than a string, for the reason `SERVICE_TOKEN` in
 * `../api-v1/tokens.ts` is one: an unannotated `string` constructor parameter
 * arrives at Nest as the class `String`, which it then tries to resolve from the
 * module graph, and there is no provider called `String`.
 */
export const DB = Symbol("DB");

/**
 * The connection a service queries.
 *
 * Named rather than spelled `NodePgDatabase<typeof schema>` at every injection
 * site, because the test suite hands Nest a PGlite-backed connection under this
 * same token and a type that says "node-postgres" would be a lie in a test that
 * is not making one. Both drivers are PostgreSQL, both expose Drizzle's `select`
 * and `insert`, and both run the generated migrations in `./drizzle`.
 */
export type Database = NodePgDatabase<typeof schema>;

/**
 * One pool, provided everywhere.
 *
 * `@Global` because every view module needs it and threading it through four
 * `imports` arrays is four lines repeated to avoid a global. `SchemaModule.forRoot`
 * is the usual answer in a Nest app, and the usual answer here would be a
 * hand-written copy of it: the connection is three lines, and a vendor module
 * that wraps three lines is a thing to read before every schema change.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Database => drizzle(loadEnv().databaseUrl, { schema, casing: "snake_case" }),
    },
    // Provided beside the connection because it is overridden beside it: both are
    // the two things a test has to control, and both are global for the same reason.
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [DB, CLOCK],
})
export class DbModule {}
