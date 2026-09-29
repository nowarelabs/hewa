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
src/app/panels/            the content each panel renders
src/app/App.tsx            <AppShell config={config} />
```

`App.tsx` has no logic in it and is not supposed to grow any. Adding a view
means adding an entry to `shell.config.tsx` and a panel module; it does not mean
editing a layout component or adding a `case` to a switch. The view id, the rail
item id and the panel collapse state are mirrored into the query string, so a
link reopens the console on the panel it was copied from.

This app was the shell's first consumer and it is the one that will break first
if the two drift. `shell.config.tsx` should read as a description of the console,
not as a place where behaviour is assembled.

## Styling

The palette, the theme tokens and the fixed-viewport base come from
`@hewa/app-shell/styles.css`; `globals.css` imports Tailwind, imports that
stylesheet, and points `@source` at the shell's compiled output. No
app-specific CSS remains, and none should be added for chrome: a colour defined
here does not follow the theme the shell toggles.

## Data

Everything except the flights feed is placeholder data, held in the panel
module that renders it. The flights feed is the only real one: `useFlights`
polls a local OpenSky mirror, whose URL comes from
`NEXT_PUBLIC_FLIGHTS_WORKER_URL`.
