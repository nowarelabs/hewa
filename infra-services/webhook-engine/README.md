# **PACKAGE**

**DESCRIPTION**

Generated from `tools/scaffold/templates/infra` by `tools/scaffold`. Edit it
freely — regeneration will not overwrite existing files without `--force`.

## Commands

```bash
pnpm run dev     # tsc --watch (run `pnpm start` alongside it)
pnpm run build   # tsc -p tsconfig.build.json
pnpm run start   # node dist/main.js
pnpm run check   # vp check, from the package directory
```

## Shape

Infrastructure processes are plain Hono servers rather than Nest services: they
sit at the edge of a dependency (Kafka, S3, Redis) and mostly need health
reporting, structured logging, and a clean shutdown. `src/server.ts` builds the
router and `src/main.ts` wires the process, so the router is testable without
binding a port.

`GET /health` returns the shared response code, the same shape as every other
hewa surface.
