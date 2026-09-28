<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

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
- Put shared `lint`, `fmt`, and task settings in the **root** `vite.config.ts`.
  Package-level `lint`/`fmt` blocks do not override the root for `vp check`.
- A task name in `vite.config.ts` must include its own `command`, and cannot
  collide with a `package.json` script name.

## Validation

```bash
vp run verify        # vp check, then vp run -r test, then vp run -r build
```

`verify` is the gate to run before handing work back. `vp check` covers
formatting, linting, and type checking; `--fix` repairs what it can.

## Releasing

Releases go through Changesets, never by hand-editing versions.

```bash
vp exec changeset    # add a .changeset/*.md file describing the change
vp run release       # changeset version + vp install (lockfile sync)
vp run ci:publish    # build everything, then publish bumped packages
```

Commit the generated `.changeset/*.md` file with the change itself. The release
workflow takes over from there. `@hewa/website` is private and listed in `ignore`
in `.changeset/config.json`.
