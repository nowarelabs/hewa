---
"@hewa/console-types": minor
---

Add the wire contract for the operations console's data.

- `ConsolePayload` maps each of the seven console views to the envelope its
  endpoint answers with, and `CONSOLE_VIEWS` is the runtime list the two can be
  checked against. `consolePath` is the only place a console URL is written down,
  because the app builds one with it and the service's tests assert a route
  against it.
- `meta.groups` carries the group vocabulary with the rows, including groups no
  row currently holds, so a summary bar can offer a filter at zero rather than
  losing the control until the data moves.
