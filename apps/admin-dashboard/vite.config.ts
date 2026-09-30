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
  test: {
    environmentOptions: {
      happyDOM: {
        settings: {
          /**
           * The streams panel embeds a YouTube player, and a test that mounts
           * that view would otherwise have the runner load the page — so the
           * suite reaches the internet, and fails or hangs for reasons that
           * have nothing to do with what it is asserting. The panel is not being
           * tested for whether a third party serves an embed.
           */
          disableIframePageLoading: true,
        },
      },
    },
  },
});
