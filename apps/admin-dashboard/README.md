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
src/app/data/              one module per view: its types and its one hook
src/app/ui/                the panel shapes every view shares
src/app/state/             the fetch, the query status, and the URL filter
src/app/App.tsx            <AppShell config={config} />
```

A view and its module are one to one and share a name: the `conflicts` view is
served by `panels/conflicts.tsx`, and the `economic` view by
`panels/economic.tsx`. The directory listing is therefore a table of contents
for the console, which it was not when `panels/` also held a shared store and a
set of primitives. `tests/views.test.ts` fails if a view has no module, a module
has no view, or the two names drift apart.

`ui/primitives.tsx` and `state/filter.ts` are not views and are not in `panels/`
for that reason. What is in `state/` is the mechanism, not the data: the fetch,
the query status, and the filter every view shares.

There is no local store, and that is the finding rather than an omission. The
console used to have one — `state/store.ts` — because the streams view played a
video and the column beside it had to say which one, and a panel's sibling is
not something a `useState` can reach. The player is gone, so the two panels that
had to agree are not, and the store went with them. Nothing in the console holds
state a URL cannot name, which is why `state/filter.ts` is the only writer.

## The bar under the title

Every main panel has a `SummaryBar` between its header and its contents, and
each one says something different, because the views show different things:

| View         | Bar                                                     | As a control                 |
| ------------ | ------------------------------------------------------- | ---------------------------- |
| `alerts`     | a count per severity                                    | filters by severity          |
| `conflicts`  | a count per incident kind                               | filters by kind              |
| `osint`      | a count per report category                             | filters by category          |
| `flights`    | a count per carrier, and how many countries are in view | filters by carrier           |
| `satellites` | a count per satellite kind                              | filters by kind              |
| `streams`    | a count per channel                                     | filters by channel           |
| `economic`   | the headline figures, which have no rows to count       | a summary — nothing to count |

The alerts view grew one of these by hand and the other six had nothing, so a
view either had a summary or had no way to say what it was showing before you
scrolled. `tests/summary.test.ts` asserts that all seven have one.

Build the chips with `summaryCounts`, which counts out of the rows, and pass
`keys` for the groups the view knows about. Those keys are no longer a constant
in the app: `meta.groups` comes from the service with the rows, so a group the
feed has nothing in still gets a chip at zero and can be pressed to say so.
Anything found in the data is counted whether or not it is in `keys` — the
conflicts feed names an `election` kind and holds no election, which is the case
that keeps a bar from losing a control the operator can no longer find.

### When a bar is a filter

A bar is a filter where it is a breakdown of the rows below it, and only there.
That is the whole rule, and it is per view, so `tests/filters.test.ts` asserts
it for all seven: nothing in a summary bar says what its rows are grouped by, so
there is otherwise no way to tell from reading a panel whether the view that
should have been a filter was left as a summary. Six are and one is not.

`economic` is the exclusion, and the reason is checkable rather than a matter of
taste: its bar is a number with no list attached to it, so there is nothing a
press could narrow. Adding a filter there would be a control that changes
nothing. `streams` was the other one until its channels became a vocabulary, the
way the flights carriers already were.

Where the bar is a filter, the chips are `FilterToggle`s in a `FilterBar`: a
press narrows the list, a second press takes it off, and two presses in a row
show both. A bar where the last chip wins reads as a dropdown that has forgotten
it is multi-select. Nothing selected shows everything — `visibleBy` is the one
place that decides, and the rule is that an empty selection is the whole list,
because a filter that empties itself when its last chip comes off is a view the
operator cannot get out of.

No view has a second control. `flights` used to: a carrier chip said how many
there were and a search box said which one you meant, and the bar had to become
one or the other because a strip of five toggles beside a text field has no room
for either. That arrangement cost `SummaryBar` a state machine, a second set of
controls and a second copy of the filters, all of it for one view. A callsign is
a column in the table, and the rows are the list to look a name up in.

A chip toggles on its **key**, not its label, and `summaryCounts` therefore
carries the key it counted on. The osint view upper-cases its categories, and a
filter keyed on `SOCIAL` is a filter keyed on a string someone has to keep in
step with the display by hand.

### The filter is in the URL

The state behind those chips is in the query string, not in a `useState` in the
panel. A filter is the one piece of a panel's state an operator needs twice: once
while looking at the list, and once after sending the link to somebody else. In
component state the second copy does not exist, so the conversation becomes
"which severity was that" and somebody reads the counts aloud.

It is the same decision the shell already makes about the view, the panel widths
and the theme, through the same `nuqs` and the same `NuqsAdapter` in
`providers.tsx`. `state/filter.ts` holds the mechanism and nothing else: which
groups a view filters on belongs to that view's module. It is the only hook in
`state/`, and it is a filter — the text search that sat beside it went with the
flights view's search box.

| Key          | Held by                 |
| ------------ | ----------------------- |
| `alerts`     | `alerts` severity chips |
| `conflicts`  | `conflicts` kind chips  |
| `osint`      | `osint` category chips  |
| `satellites` | `satellites` kind chips |
| `flights`    | `flights` carrier chips |
| `streams`    | `streams` channel chips |

Each key is named after the view that owns it, not after the property being
filtered. Conflicts and satellites both group their rows by _kind_, and a shared
`?kind=` would carry the satellites view's `weather` into the conflicts view,
match no incident, and show an empty list with no chip pressed — a filter nobody
set and nobody can see to clear. Naming the key after the view also means the
URL says which list it describes.

Three details of the URL are deliberate:

- **An empty selection removes the key.** Not `?alerts=`; an unfiltered console
  has the URL it had before anything was filtered, and a key left sitting there
  empty is the first thing anyone hand-cleans off a link before sending it.
- **History is `replace`**, which is nuqs' default and what the shell's own state
  does. The console keeps one history entry for the page, not one per press. The
  URL is an address to send, not a trail through what was pressed.
- **The search is throttled** where the chips are not, because it is a different
  input device: a chip is one press, a search box is a burst of keystrokes, and
  each one reaching the History API is a rate-limited write the browser may drop.
  Keystrokes land in the field immediately and the URL catches up when the burst
  pauses. Its parser is built inside a `useMemo` for a related reason — a
  throttler keeps its own timer, so a fresh one per render has never had a call
  to time from and its trailing edge never fires.

A key naming a group the view does not have filters to nothing and says so in the
empty state, rather than being quietly ignored. The URL said something; showing a
list that disagrees with the address bar is the one thing an address bar must
never do.

Three attributes make the rule assertable without reading a panel: the bar is
`[data-summary-bar]`, a bar that filters adds `data-filterable`, and each chip
is `[data-summary-item]` with the key in it and `aria-pressed` on it. A row the
filter acts on is `[data-row]`. The last one is not a convenience: the list is a
set of `<article>`s in four views and a `<tr>` in the fifth, and a test that
counted tag names would be testing the markup rather than the filtering.

## Controls

`ui/controls.tsx` and `ui/overlays.tsx` are the panel's own row of controls and
the things that float above it. They are here rather than in `@hewa/app-shell`
because the shell is chrome and these are content: the shell owns the title bar
and the columns, and a search box belongs to whatever the column is showing. If a
second app needs them, they move to a package at that point, not before.

| Control         | States                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| `SearchField`   | empty, filled, with a clear button, with a hint such as a result count, disabled |
| `FilterToggle`  | unpressed, pressed, with a count, disabled                                       |
| `FilterBar`     | a labelled group of the above                                                    |
| `ActiveFilters` | nothing in force, or one chip per filter in force with a clear-all               |
| `Dropdown`      | closed, open, chosen, disabled, with a disabled option that cannot be picked     |
| `Popover`       | closed, open against a trigger                                                   |
| `Modal`         | closed, open in three sizes, with or without a description and a footer          |

Two decisions are worth knowing before using them.

Every floating thing renders into a portal on `document.body`. A dropdown inside
a column that scrolls is clipped by the column otherwise, and a dropdown that is
clipped is a dropdown with half its options missing. `Modal` also takes the
keyboard while it is open — Tab cycles inside it, Escape closes it, a press
outside closes it, and closing hands focus back to whatever opened it. The half
that is usually forgotten is the last one: without it the operator is dropped at
the top of the page, tabbing through the whole document to get back.

A `Dropdown` is a listbox and not a menu of buttons, so the arrows move a
highlight that is announced as a position, and Enter picks it. The pure parts —
`matchesQuery`, `toggleValue`, `nextIndex` — are exported next to the components
because the filtering a panel does with them is where the logic is worth
testing, and testing it through a rendered tree would be testing the DOM.

`tests/overlays.test.ts` runs in `happy-dom`, scoped to that one file by a
docblock, because the questions that matter about a floating control are whether
Escape closes it and whether the trigger counts as outside. Those cannot be
asked of static markup. The rest of the suite stays in node, where SSR is what it
should be tested in.

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
every test green. Nothing replaces that test, because nothing needs it: the
store is gone.

Four files opt into `happy-dom` with a docblock, because a question about
whether a press narrows a list cannot be asked of static markup.
`tests/filters.test.ts` mounts each view's main panel and presses its chips,
`tests/shell.test.ts` asks which rail item is lit, and `tests/query.test.ts`
watches a query move from pending to ready. Everything else stays in node,
where SSR is what it should be tested in.

`tests/controls.test.ts` used to need a tree, because the search field answered
Escape and the dropdown answered the arrow keys, and both were driven with real
keyboard events. The search field is gone and the dropdown's keys are a view's
business, so that file is markup only and runs in node like the rest.

A panel with a query in it needs a `QueryClientProvider` above it, and the
second thing it needs is rows in that client: the loading state renders no rows
at all, so a test that mounted the tree without seeding it would count zero and
call it a pass. `tests/harness.tsx` builds both — `seededQueryClient()` and
`emptyQueryClient()`, the second being how the loading and failure states are
reached deliberately rather than by forgetting.

The filter state is `nuqs`, so anything rendering a main panel needs an adapter
above it — nuqs throws `NUQS-404` rather than falling back, which is what makes
the two test files fail loudly instead of quietly filtering nothing. Both use
`NuqsTestingAdapter` from nuqs rather than a hand-rolled context, and the filters
one turns on `hasMemory` so a press actually moves the in-memory query string: a
frozen one would pass every test on a filter that filtered but never wrote.

Two things about that file are easy to get wrong and cost four runs of a red
suite. `click` is awaited, because a press no longer changes anything directly —
it writes to the URL and the tree re-renders when the write comes back. And the
`url()` reader waits out nuqs' rate limit before reading, because nuqs
coalesces the writes inside that window: the tree updates on the press and the
URL follows a moment later, and whether the leading or trailing edge of the
window wins depends on the machine. The reader waits, so an assertion about the
URL cannot forget to.

Typing into a `SearchField` from a test goes through the `value` setter on
`HTMLInputElement.prototype` and not through `input.value = …`. React installs a
value tracker on the element and drops the change event when the value it holds
is the one it is handed, so assigning the property updates the DOM and leaves
React's state alone — which reads as a search field that types without filtering.

## Data

Every dataset in this console is served by `central-api` and fetched through
React Query. Nothing is seeded in the browser, and nothing is invented on a
timer.

`src/app/state/query.ts` is the boundary. It asks for the view's own path —
through `consolePath` from `@hewa/console-types`, and _relatively_, so the
browser calls this app — checks the envelope's `code`, and returns one
`ViewState`:

```ts
{
  status: ("pending" | "failed" | "ready", data, groups, refetch);
}
```

The status is a real question rather than a flag derived from a length. A view
that fails to load is not a view with zero rows, and `emptyMessage(status, …)`
keeps those two apart in the empty state: pending reads as loading, failure
reads as failure with a retry, and only a ready view with no matching rows
claims there is nothing to show. `tests/query.test.ts` asserts all three.

The fetch is relative, so there is no base URL in this app. The browser asks its
own origin for `/api/v1/alerts`, a route handler under `src/app/api/v1/` answers,
and that handler is the only place in the app that knows `central-api` exists: it
reads `CENTRAL_API_URL` and `CENTRAL_API_SERVICE_TOKEN` from the _server's_
environment and forwards the request with the token attached. Neither value is
`NEXT_PUBLIC_`, so neither is inlined into the client bundle, and the service is
not reachable from a browser at all.

One function describes the whole route. `consolePath` builds `/api/v1/{view}`,
the browser sends it, this app forwards `CENTRAL_API_URL + consolePath(view)`, and
`central-api` registers `@Controller("api/v1")` with a `Get` per view — so the
path a panel asks for and the path the service answers are the same string, and a
rename that moved one without the other fails a test rather than returning a 404.

Seven route files, one per view, and no `[...path]` catch-all. A catch-all would
be an open relay with a token attached, forwarding whatever it was handed,
including routes nobody reviewed. Each file exports only a `GET`; the surface is
read-only, so a `POST` gets Next's own 405 and the service is never asked. The
service's token guard is what makes the claim true rather than decorative — a
proxy hides the address and the token, but CORS is enforced by browsers and not
by the service, so a `curl` would get a 200 from an unguarded `/api/v1`.

`src/app/data/` is still one module per view and still named after it, but a
module is now the seam between a panel and the network rather than a file of
records. Each exports its row type and one hook, and nothing else:

```
src/app/data/alerts.ts      AlertView, useAlerts
src/app/data/conflicts.ts   IncidentView, useIncidents
src/app/data/flights.ts     FlightView, useFlights
src/app/data/osint.ts       ReportView, useReports
src/app/data/satellites.ts  SatelliteView, useSatellites
src/app/data/streams.ts     StreamView, useStreams
src/app/data/economic.ts    EconomyView, useEconomy, figuresFor
```

No runtime record arrays, no group constants. `tests/data.test.ts` fails if a
module exports a value that is not a function, because a module that still
carries its own records has stopped being the thing it claims to be and the
panel will read one while the test reads the other.

`useEconomy` keeps its `data` as `Economy | undefined` rather than mapping a
missing payload to zero figures. Every other view is a list, and a list that has
not loaded is legitimately empty; the economic view is one document, and a
zeroed document is a plausible lie. Its figures are read through `figuresFor`,
which returns nothing until there is something to read.

### Why the data moved

The records used to live here, which meant two copies of the truth: one in this
app and one in the service that is supposed to have it. They drifted, and the
symptom was a summary bar whose chips disagreed with the table under it.

They were also moving on a timer. The flights and satellites views drifted their
coordinates on an interval, the way a feed would, so the columns looked live
without being connected to anything — and a store that advanced a value was a
store with a second listener set and a timer to leak. Both stores are gone. The
timer-driven one went with the intervals; the other survived a while for the one
thing that was genuinely local, which channel in the streams view was selected,
and went when the player that needed to know went.

A record now arrives when the service says so, and it stays where it arrived.
