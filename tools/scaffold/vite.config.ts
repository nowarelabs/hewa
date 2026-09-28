import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Scoped explicitly so the templates are never collected. A template's
    // tests are placeholders with unsubstituted tokens, and they are checked
    // for real in every generated shell instead.
    include: ["tests/**/*.test.mjs"],
  },
});
