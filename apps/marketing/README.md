# **PACKAGE**

**DESCRIPTION**

Generated from `tools/scaffold/templates/astro-app` by `tools/scaffold`. Edit it
freely — regeneration will not overwrite existing files without `--force`.

## Commands

```bash
pnpm run dev      # astro dev on 3006
pnpm run build    # astro build
pnpm run preview  # astro preview on 3006
pnpm run check    # vp check, from the package directory
```

## Content

Posts live in `src/content/blog/` as Markdown, validated by
`src/content/config.ts`. `GET /health` returns the shared response code, the
same shape as every other hewa surface.

## Styling

No CSS framework. `src/styles.css` is a minimal reset with a few custom
properties.
