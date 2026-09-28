# @hewa/response-codes

The single source of truth for API response codes. Apps, services, and
infrastructure all import from here so a `3002` means the same thing
everywhere.

Codes are stable strings, grouped by the leading digit of the zero-padded
value: `0` success, `1` request, `2` auth, `3` resource, `4` throttle,
`5` system. Append new codes; never renumber an existing one.

```bash
pnpm run build
pnpm run test
```
