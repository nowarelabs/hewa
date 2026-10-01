import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { loadEnv } from "../src/config/env.js";
import { loadLocalEnv } from "../src/config/local-env.js";

/**
 * The connection string these tests put in their `.env` files.
 *
 * Spelled out rather than imported from `boot.ts` so this file stays about reading
 * a file: it asserts that the value in the file arrives in `loadEnv`, which is true
 * whatever the string says, and would be equally true of a nonsense one.
 */
const DATABASE_URL = "postgres://central-api@127.0.0.1:5432/central_api_test";

/** One line of a `.env` file. Written with `\n` because these are string literals. */
const DATABASE_LINE = `CENTRAL_API_DATABASE_URL=${DATABASE_URL}\n`;

/**
 * `.env` loading, which is what makes the copy-to-`.env` in `.env.example` mean
 * anything.
 *
 * It is tested against a real temporary file rather than a mock of `process`,
 * because the part worth pinning down is `process.loadEnvFile`'s own behaviour —
 * particularly that it does not overwrite a variable that is already set — and a
 * mock would be asserting that this function does what this function says rather
 * than that the file is read the way the example file implies.
 */
describe("loadLocalEnv", () => {
  let dir: string;
  let file: string;
  const restore = new Map<string, string | undefined>();

  /**
   * The keys this file clears before each test.
   *
   * `CENTRAL_API_DATABASE_URL` is in the list because it is the one variable
   * `loadEnv` will not do without, and these tests call `loadEnv()` with nothing
   * passed — they are about the file, so every other variable has to be absent or
   * deliberately set, and the database URL would otherwise be left behind by a
   * neighbouring suite in the same worker and make each of these tests depend on
   * execution order.
   */
  const KEYS = ["CENTRAL_API_PORT", "CENTRAL_API_SERVICE_TOKEN", "CENTRAL_API_DATABASE_URL"];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "central-api-env-"));
    file = join(dir, ".env");
    for (const key of KEYS) {
      restore.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of restore) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    restore.clear();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a missing file is not an error, because most of the time there is none", () => {
    // A container has no `.env`, so "not found" is the ordinary outcome and
    // throwing would make every deployment need a file that does not exist.
    expect(loadLocalEnv(join(dir, "absent.env"))).toBe(false);
  });

  test("it reads the file into the environment", () => {
    writeFileSync(file, `${DATABASE_LINE}CENTRAL_API_SERVICE_TOKEN=from-the-file\n`);

    expect(loadLocalEnv(file)).toBe(true);
    expect(loadEnv().serviceToken).toBe("from-the-file");
  });

  test("the database url comes out of the file too, and a `.env` alone boots", () => {
    // The point of the file: one copied `.env` is a configured service. Both
    // required variables in one line each, and `loadEnv` returns a whole `Env`
    // rather than throwing — which is the difference between a service that starts
    // and a stack trace out of `nest start --watch`.
    writeFileSync(file, `${DATABASE_LINE}CENTRAL_API_SERVICE_TOKEN=from-the-file\n`);

    loadLocalEnv(file);

    expect(loadEnv().databaseUrl).toBe(DATABASE_URL);
  });

  test("a variable already in the environment wins over the file", () => {
    // The behaviour an exported variable has to have, and the reason this is
    // worth a test: someone who exports `CENTRAL_API_SERVICE_TOKEN` to try a
    // value must not find the file quietly overriding them back.
    writeFileSync(file, `${DATABASE_LINE}CENTRAL_API_SERVICE_TOKEN=from-the-file\n`);
    process.env["CENTRAL_API_SERVICE_TOKEN"] = "from-the-shell";

    loadLocalEnv(file);

    expect(loadEnv().serviceToken).toBe("from-the-shell");
  });

  test("the token from the file is enough to stop /api/v1 answering 503", () => {
    // The end of the story, stated where the file is read: the copy in
    // `.env.example` now produces a configured service, which is the thing the
    // first version of this could not do at all.
    writeFileSync(
      file,
      `${DATABASE_LINE}CENTRAL_API_SERVICE_TOKEN=from-the-file\nCENTRAL_API_PORT=4321\n`,
    );

    loadLocalEnv(file);
    const env = loadEnv();

    expect(env.serviceToken).toBe("from-the-file");
    expect(env.port).toBe(4321);
  });
});
