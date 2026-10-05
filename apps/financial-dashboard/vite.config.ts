import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

/**
 * This file is for `vp test` and `vp check` only. Next does not read it, and
 * `next build` is unaffected by anything below.
 */
export default defineConfig({
  resolve: {
    alias: {
      /**
       * `server-only` is a build-time marker: it throws when a module graph that
       * can reach the browser imports it. `next build` is what enforces that, and
       * the runner is not a bundler, so the marker would make every test that
       * imports a route handler fail on a rule that only matters in a build.
       *
       * The alias keeps the guarantee where it belongs — the build — and lets the
       * BFF's own tests import the handler directly.
       */
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
});
