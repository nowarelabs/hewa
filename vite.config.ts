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
    cache: {
      scripts: false,
      tasks: true,
    },
    tasks: {
      verify: {
        command: ["vp check", "vp run -r test", "vp run -r build"],
      },
    },
  },
});
