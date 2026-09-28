---
"@hewa/scaffold": minor
---

Added a template generator for the app, service, and infrastructure shells.

`pnpm run scaffold` walks `tools/scaffold/manifest.mjs` and writes every
instance from one of four templates in `tools/scaffold/templates`, substituting
per-package placeholders for the name, class name, package scope, title,
description, port, and environment prefix. `--list` reports what would be
generated, naming a single instance regenerates just that one, and `--force`
overwrites files that already exist.

An instance that needs a library its template does not provide declares it as
`dependencies` in the manifest instead of forking the template, so the three
infrastructure processes ship Kafka, S3, and Redis dependencies respectively
while sharing one Hono template.
