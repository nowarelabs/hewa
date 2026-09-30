import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Read a local `.env` into `process.env`, if there is one.
 *
 * Called from `main.ts` and nowhere else, which is what keeps `loadEnv` a pure
 * function of a passed-in object: a test hands it a literal and gets a literal
 * back, and the one place that reaches for a file is the process entry point
 * where reading a file is a reasonable thing to do.
 *
 * ## Why this exists at all
 *
 * `.env.example` says "copy to .env", and before this, nothing read `.env` — the
 * file was a document about variables rather than a thing the service consumed.
 * So the documented first step of running this locally could not work, and the
 * only ways to supply the token were exporting it in the shell or wrapping the
 * start command. This is the missing half of that instruction.
 *
 * `process.loadEnvFile` rather than a dotenv dependency, because the workspace
 * has no dotenv and adding one to read a twelve-line file is not a trade worth
 * making. It also has the right precedence for free: a variable already in the
 * environment is *not* overwritten, so `CENTRAL_API_SERVICE_TOKEN=… pnpm dev`
 * still wins over the file, which is the behaviour a developer expects when they
 * export something deliberately.
 *
 * A missing file is not an error — most of the time there is no `.env` and
 * nothing to load, and that is the normal case for a container. A `.env` that
 * exists and cannot be parsed *is* an error, and it propagates: a file that was
 * written and cannot be read is a mistake worth stopping on, and the failure it
 * raises names the file.
 */
export function loadLocalEnv(file: string = resolve(process.cwd(), ".env")): boolean {
  if (!existsSync(file)) {
    return false;
  }
  process.loadEnvFile(file);
  return true;
}
