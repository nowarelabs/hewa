import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `paths` entry in tsconfig.json so the dev server and the
      // type checker resolve workspace libraries from source, with no build
      // step in between. Publishing still happens from `dist`.
      "@hewa/utils": fileURLToPath(new URL("../../packages/utils/src/index.ts", import.meta.url)),
    },
  },
});
