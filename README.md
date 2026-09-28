# hewa

A pnpm workspace monorepo, tooled entirely with [Vite+](https://viteplus.dev)
from Void Zero. Vite+ supplies the runtime and package management, the dev
server, the formatter, the linter, the type checker, the test runner, the
library packer, and the monorepo task runner behind a single `vp` command.

## Layout

```
hewa/
├── apps/                             — front ends
│   ├── website/        @hewa/website  — Vite app (private)
│   ├── customer-app/   @hewa/customer-app — Next.js
│   ├── customer-billing-portal/      — Next.js
│   ├── customer-service-portal/      — Next.js
│   ├── developer-portal/             — Next.js
│   ├── admin-dashboard/              — Next.js
│   ├── isp-partner-portal/           — Next.js
│   ├── supplier-dashboard/           — Next.js
│   ├── financial-dashboard/          — Next.js
│   ├── billing-reconciliation-ui/    — Next.js
│   └── blog/           @hewa/blog     — Astro
├── packages/                         — shared libraries
│   ├── tsconfig/       @hewa/tsconfig — base tsconfigs every package extends
│   ├── response-codes/ @hewa/response-codes — canonical API response codes
│   ├── errors/         @hewa/errors   — typed application errors
│   ├── observability/  @hewa/observability — logging, request context, metrics
│   ├── proto/          @hewa/proto    — protobuf schemas + buf-generated code
│   ├── marketplace-types/ @hewa/marketplace-types — money, SLA, capacity, transactions
│   ├── billing-domain/ @hewa/billing-domain — commitments, overage, SLA credits
│   ├── settlement-domain/ @hewa/settlement-domain — payout obligations and FX
│   ├── crypto/         @hewa/crypto  — stablecoin quotes and Ethers wrappers
│   ├── ledger-accounting/ @hewa/ledger-accounting — double-entry postings
│   └── telco-integrations/ @hewa/telco-integrations — BSS/OSS adapters
├── services/                         — NestJS services
│   ├── central-api/    @hewa/central-api — public entry point
│   ├── billing-service/
│   ├── delivery-service/
│   ├── matching-service/
│   ├── location-service/
│   ├── revenue-service/      — accrues revenue from usage
│   ├── settlement-service/   — pays ISPs out, on or off chain
│   ├── metering-service/     — meter ingestion and rating windows
│   ├── provisioning-service/ — subscriber activation
│   ├── invoicing-service/    — builds invoices, applies SLA credits
│   ├── reconciliation-service/ — matches invoices to payments
│   └── ledger-service/       — postings, trial balances, period close
├── infra-services/                   — long-running processes
│   ├── event-gateway/  @hewa/event-gateway  — Kafka, speaking @hewa/proto
│   ├── document-vault/ @hewa/document-vault — S3
│   ├── system-queue/   @hewa/system-queue   — Redis + BullMQ
│   ├── metrics-ingestion/ @hewa/metrics-ingestion — telemetry onto Kafka
│   ├── payment-gateway-adapter/ @hewa/payment-gateway-adapter — one payment interface
│   ├── webhook-engine/ @hewa/webhook-engine — signed, retried webhooks
│   └── bss-oss-sync/   @hewa/bss-oss-sync  — reconciles ISP billing systems
├── tools/
│   └── scaffold/       @hewa/scaffold — generates the shells above
├── .changeset/                       — release metadata
├── .github/workflows/                — CI and the changesets release flow
├── Dockerfile                        — pnpm deploy image for @hewa/website
├── pnpm-workspace.yaml               — workspace globs, catalog, overrides
└── vite.config.ts                    — shared lint/fmt/task configuration
```

Every workspace member depends on shared versions through the pnpm **catalog**,
so `vite`, `typescript`, and `vite-plus` are bumped in one place.

## Generating shells

The twenty-nine apps, services, and infrastructure processes are generated from
four templates. `tools/scaffold/manifest.mjs` is the single place to add, remove,
or rename one:

```bash
pnpm run scaffold -- --list               # what would be generated
pnpm run scaffold -- central-api          # just one
pnpm run scaffold -- --force              # overwrite files that already exist
```

Generation never clobbers an existing file unless you pass `--force`, so a shell
can be edited by hand without losing work. Two things keep the templates honest:

- `tests/templates.test.mjs` fails if any placeholder survives substitution.
  An unresolved `__TOKEN__` compiles fine and only breaks at runtime.
- The templates are excluded from `vp check` but **not** from `vp fmt`, so a
  generated shell is born formatted and never needs a reformat commit.

A template is shared by a whole kind. An instance that needs more than the
template provides says so in the manifest rather than forking the template:

```js
{
  kind: "infra",
  name: "event-gateway",
  dependencies: { kafkajs: "catalog:", "@hewa/proto": "workspace:*" },
}
```

## Requirements

Vite+ manages the toolchain for you, so a global `vp` is all you need:

```bash
curl -fsSL https://vite.plus | bash
```

The catalog tracks Vite+ 1.x. That is a deliberate one-time exception: 1.0.0
shipped hours before this workspace was created, and pnpm's minimum release age
would otherwise pin the install at 0.3.x. The global `vp` CLI is deliberately
left alone. The exception lives in a single commented block in
`pnpm-workspace.yaml` — drop it once 1.0.0 has aged past the gate.

## Getting started

```bash
vp install           # install with pnpm (Node and pnpm versions are managed by vp)
pnpm run verify      # the gate: check, then build, then test everything
pnpm run dev         # start the website dev server
```

`verify` runs in dependency order, because shared packages are consumed through
their built `dist` at runtime and by the tests of everything downstream:

```
check:workspace   format, lint, type check, and buf on the schemas
build:shared      the shared libraries, in dependency order
test:shared       52 tests across the five shared packages
test:tools        the generator's own tests
test:kinds        apps, then services, then infrastructure
```

### Scripts

Every task is a `package.json` script, so `pnpm run <name>`, `vp run <name>`,
and `npx <name>` all reach the same command. They all delegate to Vite+.

| Script              | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `dev`               | website dev server on port 5173                        |
| `build`             | build every package, shared dependencies first         |
| `test`              | run the full test suite                                |
| `check`             | format check, lint, and type check                     |
| `check:fix`         | the same, repairing what it can                        |
| `lint` / `lint:fix` | lint only, without the formatter                       |
| `format`            | format check only                                      |
| `format:fix`        | format in place                                        |
| `scaffold`          | generate the app, service, and infra shells            |
| `verify`            | `check` + `test` + `build`, the gate before committing |
| `cache:clean`       | drop the Vite Task cache                               |
| `changeset`         | describe a change for the next release                 |
| `release`           | apply changesets, then sync the lockfile               |
| `ci:publish`        | build and publish to npm                               |

Run a single package by selecting it explicitly:

```bash
pnpm --filter @hewa/website dev
pnpm --filter @hewa/proto test
pnpm --filter @hewa/proto build
```

`pnpm run` with no arguments lists every script; `vp run` also lists
per-package tasks.

## Ports

Every shell takes its port from the environment, defaulting to the value in its
manifest entry. The variable is the screaming-snake form of the package name, so
there is one rule to remember:

```bash
CENTRAL_API_PORT=4321 pnpm --filter @hewa/central-api dev
CENTRAL_API_LOG_LEVEL=debug pnpm --filter @hewa/central-api dev
```

`infra-services/event-gateway/.env.example` shows the two variables each process
accepts. A port outside 1–65535 is rejected at startup rather than passed to the
runtime.

## Money

Every amount in the billing, settlement, and ledger packages is a `Money`: an
integer count of the currency's minor units, plus its currency. There is no
`float` anywhere in a money path, and no price is ever parsed as one.

```ts
money(3_000, "USD"); // $30.00
money(1_250_000, "USDC"); // 1.25 USDC — six decimals, not two
```

The reason is that these amounts get summed across millions of usage windows,
compared for equality, and written into a ledger that has to balance to the cent.
A binary float cannot do any of those three things without drifting. Where a rate
has to be a fraction — an FX quote, a credit rate — it is carried as an exact
`numerator / denominator` pair rather than as a decimal.

`formatMoney` and `priceFromDecimal` are the only places that convert between a
human string and a `Money`. A price with more precision than its currency carries
is rejected rather than rounded, so a rate card is always reconcilable against the
quote it came from.

## Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets).

```bash
pnpm run changeset      # 1. describe the change, commit the .md file
pnpm run release        # 2. bump versions, update changelogs, sync lockfile
pnpm run ci:publish     # 3. build and publish to npm
```

`.github/workflows/changesets.yml` automates steps 2 and 3: pushing a changeset
to `main` opens a "chore: version packages" pull request, and merging it
publishes the affected packages. Add `NPM_TOKEN` as a repository secret and give
Actions read/write permissions so it can push the version pull request.

`@hewa/website` is private and listed in `ignore` in `.changeset/config.json`, so
only publishable packages get version bumps and changelog entries.

## Docker

The `Dockerfile` follows the pnpm monorepo recipe: one build stage, then
`pnpm deploy` to copy the minimal dependency closure for `@hewa/website` into a
runtime image.

```bash
docker build --target website -t hewa-website .
docker run --rm -p 5173:5173 hewa-website
```

## CI

`.github/workflows/ci.yml` runs `vp install`, `pnpm run verify`, and a
frozen-lockfile check using
[`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp).

## Agent instructions

`AGENTS.md` documents the Vite+ workflow and the repo conventions for coding
agents. Run `vp install` after pulling, and `pnpm run verify` before opening a
pull request.
