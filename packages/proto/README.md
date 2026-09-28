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
proto/hewa/common/v1/common.proto         Money, Metadata
proto/hewa/event/v1/event.proto           envelope + the gateway service contract
proto/hewa/delivery/v1/delivery.proto     service delivery state
proto/hewa/metering/v1/metering.proto     readings, closed windows, SLA breaches
proto/hewa/billing/v1/billing.proto       invoices, payments, disputes
proto/hewa/settlement/v1/settlement.proto payout obligations and FX quotes
proto/hewa/provisioning/v1/provisioning.proto  orders synced from ISP BSS/OSS
```

Generated code is committed to `src/gen` so consumers never need the `buf`
binary. Re-run `pnpm run proto:generate` after any schema change and commit the
result alongside it; `proto:check` runs in the root `verify` so a schema that
does not lint or format cannot land.

Breaking-change detection is wired up for a base branch:

```bash
pnpm run proto:breaking
```

## Codegen

`protoc-gen-es` (protobuf-es v2), **not** ts-proto. The Connect RPC layer needs
v2 descriptors, and ts-proto emits its own `MessageFns` encoding instead, so
the two toolchains cannot share a schema. `buf.gen.yaml` carries the reasoning
next to the options; two of them are load-bearing:

- `import_extension=.js` — `@hewa/tsconfig/base.json` sets
  `moduleResolution: nodenext`, which requires an extension on every relative
  import in an ES module.
- `int64`/`uint64` default to `bigint`, replacing ts-proto's
  `forceLong=string`. `Money.amount_minor` is happier as a `bigint`: it matches
  `TokenAmount` in `@hewa/blockchain-types`, so a money figure no longer
  changes type on its way to the chain.

Three API differences from the old ts-proto output are worth knowing, because
they are silent rather than compile errors:

- `create` / `fromBinary` / `toBinary` / `toJson` / `fromJson` replace
  `fromPartial` / `decode` / `encode().finish()` / `toJSON` / `fromJSON`.
- Enum members drop the shared proto prefix: `DeliveryStatus.UNSPECIFIED`, not
  `DeliveryStatus.DELIVERY_STATUS_UNSPECIFIED`.
- A service is `GenService.method` — a keyed object — not `methods`.

## The barrel

`src/index.ts` re-exports every generated module with `export *`. That was only
safe after the switch to protobuf-es: ts-proto emitted per-file helpers
(`DeepPartial`, `Exact`, `MessageFns`, `protobufPackage`) that collided across
modules and forced a hand-maintained list of named re-exports.

That list was **incomplete**, and silently so — it covered `common`, `delivery`,
and `event` only, so `Money` and all fifteen of the billing, metering,
provisioning, and settlement events were generated, committed, and unreachable
from the published `dist`. The package has no subpath exports and `src` is not
in `files`, so there was no other route to them. `tests/event.test.ts` now
asserts the four previously-missing schemas are reachable.

**Adding a proto module means adding one `export *` line to `src/index.ts` and
one entry each to `EventTypes` and `ROUTE_BY_TYPE` in `src/topics.ts`.**

## Topics

`src/topics.ts` is the registry every producer and consumer needs, and it did
not exist. `EventEnvelope.type` is a `string` on the wire, so nothing in the
type system stopped a publisher from typing a typo into it — and an unrecognised
event is a silent drop.

A topic is a partition count, a retention window, and a set of consumer
groups, so it is deliberately not one-per-event-type. Events are grouped by the
aggregate they partition on; the event type travels in the envelope.

`routeFor` returns `undefined` for an unknown type rather than defaulting to
some topic, and `partitionKeyFor` returns `undefined` for a payload it cannot
key. Both would otherwise fail _quietly and later_: an unroutable event is a
drop nobody notices, and a wrong partition key splits one aggregate's events
across two partitions, so its status machine tears and its totals come out
short with no error to explain it.

## Conventions

- Packages are versioned, e.g. `hewa.event.v1`. Never repurpose a field number.
- One directory per proto package, matching the package path.
- An event that must be co-partitioned with another has to carry the same key
  field. `UsageIngested` and `DeliveryStatusChanged` both gained one for this
  reason; see the comments in those schemas.
- `buf format` is the source of truth for whitespace; do not hand-format.
- Import order, RPC request/response naming, and enum value prefixes are
  enforced by `buf lint`, so let it win over convention.
