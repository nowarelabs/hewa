import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      generator: "oxc",
    },
    // Generates the `.` and `./package.json` entries from the entries above.
    // It rewrites the whole `exports` field rather than merging into it, so
    // `./styles.css` has to be re-added here or the app's
    // `@import "@hewa/app-shell/styles.css"` stops resolving with a bare
    // "package path not exported".
    //
    // The conditions are not decoration. A subpath whose target is a bare string
    // matches only under a resolver that treats a string as the unconditional
    // fallback; webpack, enhanced-resolve and Turbopack match a string against
    // the `default` condition, and a CSS import is resolved with the `style`
    // condition, so they reject it with `"./styles.css" is not exported under the
    // condition "style"`. Naming `style` and `default` satisfies every resolver
    // involved, and the failure is not caught by a Vite build: Vite accepts the
    // string, so the app compiles locally and fails in a Next build.
    //
    // The stylesheet ships from `src` and not from `dist` because it is Tailwind
    // source, not a built stylesheet: the consuming app's compiler is the one that
    // has to expand `@theme inline`.
    exports: {
      customExports: {
        "./styles.css": {
          style: "./src/styles.css",
          default: "./src/styles.css",
        },
      },
    },
    // Named explicitly: the entry is a `.tsx` file, and the default resolver
    // only probes `src/index.ts`.
    entry: ["src/index.tsx"],
    deps: {
      // Every one of these has to stay a real import. Bundling React or nuqs
      // into this package gives the app two Reacts, and the shell reads and
      // writes the URL state the app's own `NuqsAdapter` owns.
      neverBundle: ["react", "react-dom", "react/jsx-runtime", "lucide-react", "nuqs"],
    },
  },
});
