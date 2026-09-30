import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { loadEnv } from "../src/config/env.js";
import { loadLocalEnv } from "../src/config/local-env.js";

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

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "central-api-env-"));
    file = join(dir, ".env");
    for (const key of ["CENTRAL_API_PORT", "CENTRAL_API_SERVICE_TOKEN"]) {
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
    writeFileSync(file, "CENTRAL_API_SERVICE_TOKEN=from-the-file\n");

    expect(loadLocalEnv(file)).toBe(true);
    expect(loadEnv().serviceToken).toBe("from-the-file");
  });

  test("a variable already in the environment wins over the file", () => {
    // The behaviour an exported variable has to have, and the reason this is
    // worth a test: someone who exports `CENTRAL_API_SERVICE_TOKEN` to try a
    // value must not find the file quietly overriding them back.
    writeFileSync(file, "CENTRAL_API_SERVICE_TOKEN=from-the-file\n");
    process.env["CENTRAL_API_SERVICE_TOKEN"] = "from-the-shell";

    loadLocalEnv(file);

    expect(loadEnv().serviceToken).toBe("from-the-shell");
  });

  test("the token from the file is enough to stop /api/v1 answering 503", () => {
    // The end of the story, stated where the file is read: the copy in
    // `.env.example` now produces a configured service, which is the thing the
    // first version of this could not do at all.
    writeFileSync(file, "CENTRAL_API_SERVICE_TOKEN=from-the-file\nCENTRAL_API_PORT=4321\n");

    loadLocalEnv(file);
    const env = loadEnv();

    expect(env.serviceToken).toBe("from-the-file");
    expect(env.port).toBe(4321);
  });
});
