<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# hewa

A pnpm workspace monorepo. `pnpm-workspace.yaml` owns the workspace globs
(`apps/*`, `packages/*`, `services/*`, `infra-services/*`, `tools/*`), the
shared-version catalog, the pnpm overrides, and the `allowBuilds` allowlist.
`vite.config.ts` at the root owns the shared Oxfmt/Oxlint config and the staged
check.

## Packages

| Package                           | Path                             | Visibility |
| --------------------------------- | -------------------------------- | ---------- |
| `@hewa/website`                   | `apps/website`                   | private    |
| `@hewa/customer-app`              | `apps/customer-app`              | private    |
| `@hewa/customer-billing-portal`   | `apps/customer-billing-portal`   | private    |
| `@hewa/customer-service-portal`   | `apps/customer-service-portal`   | private    |
| `@hewa/developer-portal`          | `apps/developer-portal`          | private    |
| `@hewa/admin-dashboard`           | `apps/admin-dashboard`           | private    |
| `@hewa/blog`                      | `apps/blog`                      | private    |
| `@hewa/isp-partner-portal`        | `apps/isp-partner-portal`        | private    |
| `@hewa/supplier-dashboard`        | `apps/supplier-dashboard`        | private    |
| `@hewa/financial-dashboard`       | `apps/financial-dashboard`       | private    |
| `@hewa/billing-reconciliation-ui` | `apps/billing-reconciliation-ui` | private    |
| `@hewa/utils`                     | `packages/utils`                 | published  |
| `@hewa/tsconfig`                  | `packages/tsconfig`              | private    |
| `@hewa/response-codes`            | `packages/response-codes`        | published  |
| `@hewa/errors`                    | `packages/errors`                | published  |
| `@hewa/observability`             | `packages/observability`         | published  |
| `@hewa/proto`                     | `packages/proto`                 | published  |
| `@hewa/marketplace-types`         | `packages/marketplace-types`     | published  |
| `@hewa/billing-domain`            | `packages/billing-domain`        | published  |
| `@hewa/settlement-domain`         | `packages/settlement-domain`     | published  |
| `@hewa/crypto`                    | `packages/crypto`                | published  |
| `@hewa/ledger-accounting`         | `packages/ledger-accounting`     | published  |
| `@hewa/telco-integrations`        | `packages/telco-integrations`    | published  |
| `@hewa/scaffold`                  | `tools/scaffold`                 | private    |
| `@hewa/central-api` …             | `services/*`                     | private    |
| `@hewa/event-gateway` …           | `infra-services/*`               | private    |

## Generated shells

The ten apps, twelve services, and seven infrastructure processes come from four
templates in `tools/scaffold/templates`. Edit a template, then regenerate; edit
`tools/scaffold/manifest.mjs` to add, remove, or rename an instance.

```bash
pnpm run scaffold -- --list          # what would be generated
pnpm run scaffold -- central-api     # just one
pnpm run scaffold -- --force         # overwrite existing files
```

Rules for working on the generator:

- Never hand-edit a generated shell to fix something the template gets wrong.
  The same file exists in fourteen places, and the next `--force` wins.
- Generation skips existing files unless `--force` is passed, so hand edits
  survive a normal run. That is a safety net, not an invitation.
- Placeholders are `__NAME__`, `__CLASS__`, `__PACKAGE__`, `__TITLE__`,
  `__DESCRIPTION__`, `__PORT__`, `__ENV_PREFIX__`, and `__TITLE_LOWER__`. A
  token may run straight into more identifier characters, as
  `__ENV_PREFIX___PORT` does; `substitute` matches lazily so the suffix
  survives.
- `tests/templates.test.mjs` fails if any placeholder survives substitution for
  any instance. An unresolved token compiles and only breaks at runtime.
- An instance that needs more than its template provides declares
  `dependencies` in the manifest. Do not fork the template to add one library.
- Templates are excluded from root `lint` and `typecheck` but **not** from
  `fmt`, so a generated shell is born formatted. Run `vp fmt` on
  `tools/scaffold/templates` after editing one.

## Rules

- Add shared dependencies to the **catalog** in `pnpm-workspace.yaml` and
  reference them as `catalog:` from each package. Never pin versions directly in
  a workspace package.
- Reference sibling packages with `workspace:*`, never a semver range.
- `@hewa/utils` is resolved from source during development through a
  `paths` entry in `apps/website/tsconfig.json` and a matching `resolve.alias`
  in `apps/website/vite.config.ts`. Keep the two in sync, and do not drop the
  `dist` conditions from `packages/utils/package.json`.
- Shared packages depend on each other through built `dist` output at **runtime**
  and test time. Type checking uses a `paths` entry pointing at the sibling
  `src`, but Vite and Vitest resolve through `node_modules`. Build a shared
  package before testing anything that depends on it; `build:shared` in the
  root `package.json` does this in dependency order, and `verify` runs it
  before the tests.
- A package that emits must clear `paths` in its `tsconfig.build.json`. The
  `paths` entry pulls sibling **source** into the program, and tsc then tries to
  compile it into the emitter's output. It must also set
  `allowImportingTsExtensions: false`, since the base config enables it for
  type checking only.
- Shared tsconfigs in `packages/tsconfig` must not declare `include`, `exclude`,
  `paths`, `rootDir`, or `outDir`. All of those resolve relative to the file
  that declares them, so inheriting them from a shared config points them at
  `packages/tsconfig`. A package sets them in its own configs.
- `vp pack` emits declarations with `isolatedDeclarations`. Exported `const`
  objects that reference another inferred binding need an explicit type
  annotation, and lookup tables must be keyed by the **value** consumers pass,
  not by the enum member name.
- `packages/proto/src/gen` is generated by `buf`. It is committed so consumers
  do not need the `buf` binary, and it is excluded from `fmt` and `lint` in the
  root `vite.config.ts`. Edit `proto/`, then run `pnpm run proto:generate`.
  `buf lint` rejects an unused import, so a new schema that does not reference
  `hewa.common.v1` must not import it.
- Money is an integer count of a currency's minor units, never a `float`, and a
  rate is an exact `numerator / denominator` pair rather than a decimal. These
  amounts are summed, compared for equality, and written to a ledger that has to
  balance, and a binary float fails at all three. A price with more precision
  than its currency carries is rejected, not rounded.
- A float must not decide a boundary, and the fix is never an epsilon. `(1 - 0.9) * 100`
  is `9.999999999999998`, and the old fix added `1e-9` before flooring, which
  traded a wrong answer for a wrong answer that only looks right. An availability
  target is now an integer in **basis points** and a credit is an exact
  `numerator / denominator`, so the shortfall is a `BigInt` division that is
  exact by construction. Rounding happens once, explicitly, half away from zero,
  and the credit is capped so it can never exceed the bill. `creditablePoints` in
  `@hewa/marketplace-types` computes a whole number of points from basis points;
  if a calculation needs a fudge factor to produce a clean result, the input
  representation is wrong.
- A third-party integration takes its dependencies through an interface, not an
  import: a `HttpClient` or a `StablecoinWallet` is passed in, so the adapter is
  a pure translation layer and its tests run with no network and no credentials.
  A vendor's error body may carry customer data, so it is not propagated into an
  exception that will be logged on our side.
- Never leave a build artifact in a `src` or `tests` directory. `dist` is
  ignored; `packages/*/src/*.js` is not, and it will be committed.
- Put shared `lint` and `fmt` settings in the **root** `vite.config.ts`.
  Package-level `lint`/`fmt` blocks do not override the root for `vp check`.
- Tasks live in `package.json` scripts, not in `vite.config.ts`, so that
  `pnpm run <name>`, `vp run <name>`, and `npx <name>` all reach the same
  command. Every script delegates to `vp`; do not call `pnpm` or `npx` directly.
- `vp run --filter=<glob>` is recursive by itself and cannot be combined with
  `-r`. Its value must be attached with `=`, because `--filter` is variadic and
  would otherwise swallow the task name. The root package is `hewa`, so
  `build:all` filters with `--filter=!hewa`; `-r build` would re-enter the
  root's own `build` script and recurse.
- The catalog tracks Vite+ `^1` as a deliberate one-time exception, via the
  commented `minimumReleaseAgeExclude` block in `pnpm-workspace.yaml`. Leave the
  global `vp` CLI alone.
- `allowBuilds` in `pnpm-workspace.yaml` is an explicit supply-chain
  allowlist, and pnpm 12 fails the install on any unlisted build script. Set an
  entry to `false` to acknowledge and deny one — `msgpackr-extract` is a
  BullMQ transitive whose native build buys nothing here.

## Validation

```bash
pnpm run verify       # check, build shared, then test everything
pnpm run check:fix    # format, lint, and type check with autofix
```

`verify` is the gate to run before handing work back. `pnpm run` with no
arguments lists every script; `vp run` also lists per-package tasks.

Every shell takes its port from `<SCREAMING_SNAKE_NAME>_PORT` and its verbosity
from `<SCREAMING_SNAKE_NAME>_LOG_LEVEL`, defaulting to the manifest value. See
`infra-services/event-gateway/.env.example`.

## Releasing

Releases go through Changesets, never by hand-editing versions.

```bash
pnpm run changeset    # add a .changeset/*.md file describing the change
pnpm run release      # changeset version + vp install (lockfile sync)
pnpm run ci:publish   # build everything, then publish bumped packages
```

Commit the generated `.changeset/*.md` file with the change itself. The release
workflow takes over from there. `@hewa/website` is private and listed in `ignore`
in `.changeset/config.json`.

## On-chain amounts and signatures

- A token amount crossing a contract boundary is a `bigint` in that token's base
  units, never a `number` and never a `float`. USDC has 6 decimals, so
  `$6,700` is `6_700_000_000n`, and `6700 * 1e18` is wrong twice over: it is
  the wrong token and it is not a safe integer. `assertTokenAmount` rejects a
  `number` on purpose — by the time a figure arrives as a float, the precision is
  already gone and no later check can recover it.
- A hash is 32 bytes and an EIP-191 signature is 65. They are separate types
  (`Hex32`, `Signature`) with separate assertions because one predicate for both
  would either reject every real signature or accept a bare digest as one.
- Sign the raw digest bytes, not the hex string. Ethers treats a `string`
  argument to `signMessage` as UTF-8 text, so signing `"0xabc…"` covers 66
  characters where a contract's `ECDSA.toEthSignedMessageHash(bytes32)` covers 32.
  `signDigest` and `recoverDigestSigner` in `@hewa/crypto` do this, and the
  Solidity and TypeScript suites assert the same vectors.
- EIP-712 digests are built by `TypedDataEncoder`, not assembled by hand. A
  hand-written EIP-712 encoder is a second implementation of a spec whose only
  correctness criterion is agreeing with the contract, and a mistake in it
  produces signatures that recover to nobody — with no local symptom until the
  transaction is sent.
- The domain must include the chain and the contract. Without the contract, a
  signature authorises revenue on whichever deployment presents it; without the
  chain, it is valid on every chain that key has ever touched.
- A signature proves _attribution_, not truth. A commitment is worth exactly what
  the signer's key is worth, and the same key could sign anything. Data that has
  to be believable is believed because independent sources agree: the Merkle
  root, the ledger, and the monthly comparison all have to line up, and
  `checkTotals` failing by one base unit is a failed report.
