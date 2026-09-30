# @hewa/console-types

The admin console's API contract: what a record is, and the envelope it arrives
in.

The records themselves are not here. They are hardcoded in
[`@hewa/central-api`](../../services/central-api) behind one endpoint per view,
because data belongs behind an endpoint. What is here is the _shape_, so a
renamed field is a build failure in the place that fills it rather than an
`undefined` on screen.

## The envelope

```ts
interface ConsoleEnvelope<TData, TGroup extends string> {
  code: ResponseCode;
  data: TData;
  meta: { groups: TGroup[] };
}
```

`code` is the shared [`@hewa/response-codes`](../response-codes) code every
surface in the workspace already answers with. `data` is the rows. `meta` is the
part that is not rows, and it exists as a named object so a view that later needs
a total or a cursor adds a key instead of changing the shape the rows sit in.

`meta.groups` is a **vocabulary**, not a count. A summary bar builds one chip per
group out of it, so a group with nothing in it still gets a chip at zero and can
still be pressed. Derived from the rows alone, a chip appears and disappears as
the data moves, which is a control that is only sometimes there.

## Adding a view

Four edits, in this order:

1. A record module in `src/`, named after the view.
2. An entry in `ConsolePayload` and in `CONSOLE_VIEWS` in `src/envelope.ts`.
3. A route in the service, plus a `records/<view>.ts` beside the others.
4. A `src/app/data/<view>.ts` in the console.

Steps 2 and 4 are held together by two assertions rather than by hand: the service
walks `CONSOLE_VIEWS` asserting each one routes, and the console's
`tests/data.test.ts` asserts `CONSOLE_VIEWS` is the shell config's `views` keys.

```bash
pnpm run build
pnpm run test
```
