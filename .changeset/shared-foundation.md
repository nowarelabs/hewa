---
"@hewa/response-codes": minor
"@hewa/errors": minor
"@hewa/observability": minor
"@hewa/proto": minor
---

Add the shared foundation every service, app, and infrastructure process builds
on.

- `@hewa/response-codes` is the single source of truth for API response codes.
  Codes are stable strings grouped by the leading digit of the zero-padded
  value, each with a default HTTP status, so a `3002` means the same thing in
  every process.
- `@hewa/errors` provides `AppError` and its subclasses, carrying a stable
  error code and the matching response code. `toAppError` normalizes arbitrary
  throwables, so internal messages never reach a client.
- `@hewa/observability` provides one logging shape, `AsyncLocalStorage`-backed
  request context, and a small metrics registry, with no vendor SDK wired in.
- `@hewa/proto` holds the protobuf schemas and the TypeScript `buf` generates
  from them. Generated code is committed so consumers do not need the `buf`
  binary.
