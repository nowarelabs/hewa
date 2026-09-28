import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
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
