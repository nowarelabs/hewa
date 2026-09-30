# Admin dashboard

The internal operations console: flight tracking, satellite and stream
monitoring, economic indicators, and an open-source intelligence feed, in one
shell with seven views.

## Commands

```bash
pnpm run dev     # next dev on 3005
pnpm run build   # next build
pnpm run start   # next start on 3005
pnpm run check   # vp check, from the package directory
```

## Health

`GET /health` returns the shared response code from `@hewa/response-codes`, so
every surface in the workspace answers health checks identically.

## How the app is put together

The layout is not this app's code. It is
[`@hewa/app-shell`](../../packages/app-shell): a title bar with view tabs, an
icon rail, three collapsible columns and a status bar, driven by one config
object.

```
src/app/shell.config.tsx   every view, rail item, panel and status line, as data
src/app/panels/            one module per view, named after its view id
src/app/ui/                the panel shapes every view shares
src/app/state/             the store two panels of one view agree through
src/app/App.tsx            <AppShell config={config} />
```

A view and its module are one to one and share a name: the `conflicts` view is
served by `panels/conflicts.tsx`, and the `economic` view by
`panels/economic.tsx`. The directory listing is therefore a table of contents
for the console, which it was not when `panels/` also held a shared store and a
set of primitives. `tests/views.test.ts` fails if a view has no module, a module
has no view, or the two names drift apart.

`ui/primitives.tsx` and `state/store.ts` are not views and are not in `panels/`
for that reason. State a single view owns stays in that view's module: the
satellite catalogue is in `panels/satellites.tsx` and the selected channel in
`panels/streams.tsx`, because both exist to keep two panels of one view in step.
What is in `state/` is the mechanism, not the data.

## The bar under the title

Every main panel has a `SummaryBar` between its header and its contents, and
each one says something different, because the views show different things:

| View         | Bar                                                        |
| ------------ | ---------------------------------------------------------- |
| `alerts`     | a count per severity                                       |
| `conflicts`  | a count per incident kind                                  |
| `osint`      | a count per report category                                |
| `flights`    | a count per carrier, and how many countries are in view    |
| `satellites` | a count per satellite kind                                 |
| `streams`    | what is on screen, and how many rail entries back the rail |
| `economic`   | the headline figures, which have no rows to count          |

The alerts view grew one of these by hand and the other six had nothing, so a
view either had a summary or had no way to say what it was showing before you
scrolled. `tests/summary.test.ts` asserts that all seven have one.

Build the chips with `summaryCounts`, which counts out of the rows, and pass
`keys` for the groups the view knows about so an empty group still gets a chip
and the bar does not lose its contents while a feed is loading. Anything found
in the data is counted whether or not it is in `keys`: the osint rail has no
social entry and two of the seeded reports are social, and a bar built from the
rail alone would have reported four reports fewer than the feed holds.

`App.tsx` has no logic in it and is not supposed to grow any. Adding a view
means adding an entry to `shell.config.tsx` and a module beside it; it does not
mean editing a layout component or adding a `case` to a switch. The view id, the
rail item id and the panel collapse state are mirrored into the query string, so
a link reopens the console on the panel it was copied from.

This app was the shell's first consumer and it is the one that will break first
if the two drift. `shell.config.tsx` should read as a description of the console,
not as a place where behaviour is assembled.

## Styling

The palette, the theme tokens and the fixed-viewport base come from
`@hewa/app-shell/styles.css`; `globals.css` imports Tailwind, imports that
stylesheet, and points `@source` at the shell's compiled output. No
app-specific CSS remains, and none should be added for chrome: a colour defined
here does not follow the theme the shell toggles.

## Tests

`vp test` runs against `vite.config.ts`, which exists only for the test runner.
The app's tsconfig says `jsx: "preserve"` because Next compiles JSX with SWC,
and Vite reads that same setting for its own transform, so a test importing a
`.tsx` module would otherwise hand raw JSX to the SSR transform and fail with
`Unexpected JSX expression`. The `oxc.jsx` override in the Vite config gives the
runner the automatic runtime; `next build` is unaffected.

Without it this app had no way to test a component at all, which is how a store
that advanced its value without notifying one subscriber reached `main` with
every test green. `tests/store.test.ts` now covers that path.

## Data

Everything except the flights feed is placeholder data, held in the panel
module that renders it. The flights feed is the only real one: `useFlights`
polls a local OpenSky mirror, whose URL comes from
`NEXT_PUBLIC_FLIGHTS_WORKER_URL`.
