# **PACKAGE**

**DESCRIPTION**

Generated from `tools/scaffold/templates/next-app` by `tools/scaffold`. Edit it
freely — regeneration will not overwrite existing files without `--force`.

## Commands

```bash
pnpm run dev     # next dev on 3008
pnpm run build   # next build
pnpm run start   # next start on 3008
pnpm run check   # vp check, from the package directory
```

## Health

`GET /health` returns the shared response code from `@hewa/response-codes`, so
every surface in the workspace answers health checks identically.

## Styling

No CSS framework. `src/app/globals.css` is a minimal reset with a few custom
properties; add component styles as this app grows real UI.
