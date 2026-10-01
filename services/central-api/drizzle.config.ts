import { defineConfig } from "drizzle-kit";

import { loadEnv } from "./src/config/env.js";

/**
 * The migration tool's view of the same schema the application uses.
 *
 * `schema` points at the TypeScript rather than being restated here, so the
 * migrations in `./drizzle` are generated from the columns the service selects
 * rather than from a second description of them that nobody checks.
 *
 * `dbCredentials` reads `DATABASE_URL` through `loadEnv` — the same function
 * `main.ts` and `DbModule` use — so the tool, the application and the tests
 * cannot be pointed at three different databases. `generate` never opens a
 * connection, which is why an unset URL is only a problem for `migrate`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: loadEnv().databaseUrl },
});
