import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // buf owns the formatting of generated proto code. Templates *are* formatted
    // here, so a generated shell is born formatted and never needs a reformat
    // commit. drizzle-kit owns `drizzle/meta`, which is its own snapshot of the
    // schema and is rewritten on every `db:generate` — formatting it would commit a
    // diff that the next generate throws away.
    ignorePatterns: ["packages/proto/src/gen/**", "services/central-api/drizzle/meta/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: [
      "packages/proto/src/gen/**",
      "services/central-api/drizzle/meta/**",
      "tools/scaffold/templates/**",
    ],
  },
  run: {
    // Task definitions live in package.json scripts so that `pnpm run <name>`,
    // `vp run <name>`, and package-level invocation all reach the same command.
    cache: {
      scripts: false,
      tasks: true,
    },
  },
});
