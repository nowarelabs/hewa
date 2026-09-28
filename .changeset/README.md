# Changesets

This folder holds the release metadata for the Hewa monorepo. Each markdown
file describes a single change to one or more packages, and Changesets turns
them into version bumps, changelog entries, and npm publishes.

## Adding a change

```bash
vp exec changeset
```

Pick the affected packages, choose a bump type (`patch`, `minor`, `major`), and
write a short summary in the past tense. Commit the generated file with your
code — that is what triggers a release.

## Releasing

```bash
vp run release
```

This runs `changeset version` (bumps versions, updates `CHANGELOG.md` files,
refreshes the `workspace:` ranges) and then `vp install` to sync the lockfile.
Commit the result, then `vp run ci:publish` (or the release workflow) pushes the
packages to npm.

`.github/workflows/changesets.yml` automates both steps: it opens a
"Version Packages" pull request and publishes once that pull request is merged.
