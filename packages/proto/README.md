# @hewa/proto

Protobuf schemas for hewa, and the TypeScript `buf` generates from them.

```bash
pnpm run proto:lint      # buf lint, STANDARD rules
pnpm run proto:check     # lint + format check
pnpm run proto:generate  # buf generate -> src/gen
pnpm run build           # vp pack
```

## Layout

Schemas live under `proto/`, one directory per proto package so `buf lint`
accepts them:

```
proto/hewa/common/v1/common.proto      metadata carried by every message
proto/hewa/event/v1/event.proto        envelope + the gateway service contract
proto/hewa/delivery/v1/delivery.proto  delivery state, used by the delivery service
```

Generated code is committed to `src/gen` so consumers never need the `buf`
binary. Re-run `pnpm run proto:generate` after any schema change and commit the
result alongside it; `proto:check` runs in the root `verify` so a schema that
does not lint or format cannot land.

Breaking-change detection is wired up for a base branch:

```bash
pnpm run proto:breaking
```

## Conventions

- Packages are versioned, e.g. `hewa.event.v1`. Never repurpose a field number.
- One directory per proto package, matching the package path.
- `buf format` is the source of truth for whitespace; do not hand-format.
- Import order, RPC request/response naming, and enum value prefixes are
  enforced by `buf lint`, so let it win over convention.
