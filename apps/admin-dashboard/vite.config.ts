import { defineConfig } from "vite-plus";

/**
 * This file is for `vp test` and `vp check` only. Next does not read it, and
 * `next build` is unaffected by anything below.
 */
export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
});
