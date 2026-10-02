import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { CentralApiAppModule } from "../src/app.module.js";
import { CentralApiErrorFilter } from "../src/common/error.filter.js";
import { corsDelegate } from "../src/config/cors.js";
import { loadEnv } from "../src/config/env.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";
import { WRITE_TOKEN_HEADER } from "../src/api-v1/write-token.guard.js";
import { DB, type Database } from "../src/db/db.module.js";
import { seedDatabase } from "../src/db/seed.js";
import * as schema from "../src/db/schema.js";

/**
 * The token the e2e suite presents.
 *
 * Set on `process.env` before the application boots, because the guard reads the
 * token from the loaded environment at resolution time. A test cannot pass it in
 * as an argument: the point being tested is that a request with the wrong token is
 * refused, and a suite that configured its own token per test would be asserting
 * against whatever it just set rather than against the deploy's configuration.
 */
export const TEST_TOKEN = "e2e-service-token";

/**
 * The write token the e2e suite presents.
 *
 * A different value from {@link TEST_TOKEN}, deliberately: a suite that configured
 * both guards with the same secret would pass every token test below while proving
 * nothing about the two being separate. A write that presented the read token would
 * be caught, and so would a read presented the write token.
 */
export const TEST_WRITE_TOKEN = "e2e-write-token";

/**
 * The connection string the boot is configured with, and never dials.
 *
 * `loadEnv` requires `CENTRAL_API_DATABASE_URL` because a service without one has
 * nothing to serve and should say so at boot, which means the variable has to be
 * set even though the `DB` provider below is overridden and this URL is never
 * opened. That is the arrangement to be deliberate about: it is safe because
 * `overrideProvider` replaces the factory before it runs, so no pool is ever
 * constructed from it. It is here, spelled as a localhost URL rather than left as a
 * placeholder, so that if the override ever stops working the suite fails with a
 * connection refused instead of quietly passing against a developer's real data.
 */
export const TEST_DATABASE_URL =
  "postgres://central-api:central-api@127.0.0.1:5432/central_api_test";

/** What a request with no token, or the wrong one, is refused with. */
export const UNAUTHORIZED_BODY = /service token is required/;

/** What a service with no token configured says, which is a different failure. */
export const UNAVAILABLE_BODY = /CENTRAL_API_SERVICE_TOKEN/;

/** The same, for the write side. */
export const WRITE_UNAVAILABLE_BODY = /CENTRAL_API_WRITE_TOKEN/;

/**
 * What a write refused for its *write* token says.
 *
 * Its own constant rather than a second use of {@link UNAUTHORIZED_BODY}, because the
 * message names the credential that was missing and that is the thing worth
 * asserting: a request with a valid read token and no write token must be told it is
 * the write token that is absent. A shared pattern would let "a valid central api
 * service token is required" pass as an answer to the wrong question.
 */
export const WRITE_UNAUTHORIZED_BODY = /write token is required/;

/**
 * The committed migrations, found relative to this file.
 *
 * The generated SQL in `drizzle/` rather than `push`ed into whatever the URL points
 * at, so the tests apply exactly the schema a deployment applies. A test that built
 * its own tables from `schema.ts` would be testing a schema no one runs, and would
 * keep passing after a migration changed a column it happened not to select.
 */
const MIGRATIONS_FOLDER = resolve(fileURLToPath(import.meta.url), "../../drizzle");

export interface BootOptions {
  /**
   * The token to configure, or `null` to configure none.
   *
   * `null` boots a service with no `CENTRAL_API_SERVICE_TOKEN` at all, which is
   * the state a developer is in before copying `.env.example` to `.env`. It is
   * not reachable by clearing the variable after boot, because the guard reads it
   * once at resolution.
   */
  readonly serviceToken?: string | null;

  /**
   * The write token to configure, or `null` to configure none.
   *
   * `null` boots a service that can be read and not written — the state a
   * read-only deployment is in, and the one that has to refuse a write with 503
   * rather than 401, because the caller's token is not wrong, this side's is
   * missing.
   */
  readonly writeToken?: string | null;
}

/** A test database, and the handle that shuts it down. */
export interface TestDatabase {
  readonly db: Database;
  close(): Promise<void>;
}

/**
 * An in-memory PostgreSQL with the migrations applied and the seed rows in it.
 *
 * ## Why PGlite and not a container
 *
 * The suite has to be able to assert on constraints — that a basis-point column
 * refuses 10 001, that a fee cannot go negative — and it has to do it without a
 * `docker compose up` in the instructions. PGlite is PostgreSQL compiled to
 * WebAssembly, so `CHECK` constraints, `ENUM`s, `FILTER`, window functions and
 * generated identities all behave as they do on a server. A mock of the driver
 * would not: the assertions here are exactly the ones a mock answers.
 *
 * ## Why the rows are seeded
 *
 * Because the view is now derived. The market's headline is a sum over the per-pool
 * aggregates and its shares come out of a largest-remainder division, and the SLA
 * states are stored rather than computed at read time — all of which is only
 * checkable against rows somebody put there. `seedDatabase` is the same function
 * `pnpm db:seed` runs, so the numbers a test pins are the numbers a developer
 * sees.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" });

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await seedDatabase(db as unknown as Database);

  return {
    db: db as unknown as Database,
    close: () => client.close(),
  };
}

/**
 * Boot the real application over an in-memory database.
 *
 * The whole module graph, the global error filter, the guard, the CORS delegate —
 * which is the only way to prove `/api/v1` is guarded at all, and that each view's
 * controller is reachable from the module that declares it. A unit test of a
 * controller would pass with the module graph broken and the guard missing.
 *
 * The `DB` provider is overridden rather than pointed somewhere real. Everything
 * else is production's own wiring: the same `DbModule`, the same factories, the
 * same guards, resolved in the same order. Overriding one provider is the
 * substitution; rewriting the module graph to make a fake database is a different
 * suite that would pass with `DbModule` deleted.
 */
export async function bootCentralApi(options: BootOptions = {}): Promise<INestApplication> {
  const token = options.serviceToken === undefined ? TEST_TOKEN : options.serviceToken;
  const writeToken = options.writeToken === undefined ? TEST_WRITE_TOKEN : options.writeToken;

  if (token === null) {
    delete process.env["CENTRAL_API_SERVICE_TOKEN"];
  } else {
    process.env["CENTRAL_API_SERVICE_TOKEN"] = token;
  }

  if (writeToken === null) {
    delete process.env["CENTRAL_API_WRITE_TOKEN"];
  } else {
    process.env["CENTRAL_API_WRITE_TOKEN"] = writeToken;
  }
  process.env["CENTRAL_API_DATABASE_URL"] = TEST_DATABASE_URL;

  const database = await createTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [CentralApiAppModule],
  })
    .overrideProvider(DB)
    .useValue(database.db)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new CentralApiErrorFilter());
  // The real policy, not a copy of it. CORS is the one piece of this service's
  // behaviour that is decided in `main.ts`, and a suite that booted without it
  // would pass against a service that allowed every origin to read `/api/v1`.
  app.enableCors(corsDelegate(loadEnv().corsOrigins));
  await app.listen(0);

  // Closing the application must also close the database, or PGlite holds a
  // WebAssembly heap for the rest of the worker's life and the next suite's boot
  // pays for it.
  const close = app.close.bind(app);
  app.close = async () => {
    await close();
    await database.close();
  };

  return app;
}

/**
 * A `fetch` that already carries the token, for the common case.
 *
 * The caller's headers are normalised through `Headers` rather than spread, so that
 * a `Headers` or a list of pairs still works — a spread of either yields no entries
 * at all, which would quietly drop the caller's own headers.
 */
export function authorized(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(SERVICE_TOKEN_HEADER, TEST_TOKEN);
  return fetch(url, { ...init, headers });
}

/**
 * A `fetch` that carries both tokens, which is what a write needs.
 *
 * Both, because both guards run on a write route — see `write-token.guard.ts`. A
 * helper that set only the write token would have been a second, wrong answer in
 * this file about who is allowed to write, and the guard suite below is where that
 * would have been caught.
 */
export function writing(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(SERVICE_TOKEN_HEADER, TEST_TOKEN);
  headers.set(WRITE_TOKEN_HEADER, TEST_WRITE_TOKEN);
  return fetch(url, { ...init, headers });
}

/**
 * A `fetch` carrying the named tokens and no others.
 *
 * The guard tests need to present *one* token rather than two, and setting the
 * other one to an empty string would not do it: an empty header is a header, and
 * what is being tested is the absence of one.
 */
export function withTokens(
  url: string,
  tokens: Partial<Record<typeof SERVICE_TOKEN_HEADER | typeof WRITE_TOKEN_HEADER, string>>,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(tokens)) {
    if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return fetch(url, { ...init, headers });
}
