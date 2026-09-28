import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // buf owns the formatting of generated proto code. Templates *are* formatted
    // here, so a generated shell is born formatted and never needs a reformat
    // commit.
    ignorePatterns: ["packages/proto/src/gen/**"],
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
    ignorePatterns: ["packages/proto/src/gen/**", "tools/scaffold/templates/**"],
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
