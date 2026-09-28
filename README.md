# hewa

A pnpm workspace monorepo, tooled entirely with [Vite+](https://viteplus.dev)
from Void Zero. Vite+ supplies the runtime and package management, the dev
server, the formatter, the linter, the type checker, the test runner, the
library packer, and the monorepo task runner behind a single `vp` command.

## Layout

```
hewa/
├── apps/
│   └── website/        @hewa/website  — Vite app (private)
├── packages/
│   └── utils/          @hewa/utils    — published library (tsdown)
├── tools/                            — workspace for code generators
├── .changeset/                       — release metadata
├── .github/workflows/                — CI and the changesets release flow
├── Dockerfile                        — pnpm deploy image for @hewa/website
├── pnpm-workspace.yaml               — workspace globs, catalog, overrides
└── vite.config.ts                    — shared lint/fmt/task configuration
```

Every workspace member depends on shared versions through the pnpm **catalog**,
so `vite`, `typescript`, and `vite-plus` are bumped in one place.

## Requirements

Vite+ manages the toolchain for you, so a global `vp` is all you need:

```bash
curl -fsSL https://vite.plus | bash
```

## Getting started

```bash
vp install        # install with pnpm (Node and pnpm versions are managed by vp)
vp run verify     # vp check + all tests + all builds
vp run dev        # start the website dev server
```

Run a single package with the global `-C` flag or by selecting it explicitly:

```bash
vp -C apps/website dev
vp -C packages/utils pack --watch
vp run @hewa/utils#test
vp run -r build
```

## Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets).

```bash
vp exec changeset          # 1. describe the change, commit the .md file
vp run release             # 2. bump versions, update changelogs, sync lockfile
vp run ci:publish          # 3. build and publish to npm
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

`.github/workflows/ci.yml` runs `vp install`, `vp check`, `vp run -r test`, and
`vp run -r build` using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp),
then verifies the lockfile is still in sync.

## Agent instructions

`AGENTS.md` documents the Vite+ workflow for coding agents. Run `vp install`
after pulling, and `vp check` plus `vp run -r test` before opening a pull
request.
