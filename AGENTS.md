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
(`apps/*`, `packages/*`, `tools/*`), the shared-version catalog, and the pnpm
overrides. `vite.config.ts` at the root owns the shared Oxfmt/Oxlint config, the
staged check, and the task definitions.

## Packages

| Package         | Path             | Visibility |
| --------------- | ---------------- | ---------- |
| `@hewa/website` | `apps/website`   | private    |
| `@hewa/utils`   | `packages/utils` | published  |

## Rules

- Add shared dependencies to the **catalog** in `pnpm-workspace.yaml` and
  reference them as `catalog:` from each package. Never pin versions directly in
  a workspace package.
- Reference sibling packages with `workspace:*`, never a semver range.
- `@hewa/utils` is resolved from source during development through a
  `paths` entry in `apps/website/tsconfig.json` and a matching `resolve.alias`
  in `apps/website/vite.config.ts`. Keep the two in sync, and do not drop the
  `dist` conditions from `packages/utils/package.json`.
- Put shared `lint` and `fmt` settings in the **root** `vite.config.ts`.
  Package-level `lint`/`fmt` blocks do not override the root for `vp check`.
- Tasks live in `package.json` scripts, not in `vite.config.ts`, so that
  `pnpm run <name>`, `vp run <name>`, and `npx <name>` all reach the same
  command. Every script delegates to `vp`; do not call `pnpm` or `npx` directly.
- The catalog tracks Vite+ `^1` as a deliberate one-time exception, via the
  commented `minimumReleaseAgeExclude` block in `pnpm-workspace.yaml`. Leave the
  global `vp` CLI alone.

## Validation

```bash
pnpm run verify       # vp check, then all tests, then all builds
pnpm run check:fix    # format, lint, and type check with autofix
```

`verify` is the gate to run before handing work back. `pnpm run` with no
arguments lists every script; `vp run` also lists per-package tasks.

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
