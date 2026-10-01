# Admin dashboard

The internal operations console for the bandwidth marketplace: the trading
market, the network it rides on, the money owed across it, the commitments sold
on it, and the alerts raised about it, in one shell with five views and sixteen
sections.

A **view** is a group of related questions and gets a tab. A **section** is one
of those questions and gets a rail button, an endpoint, a main column and a right
column. The rail is navigation, not filtering: every rail button leads somewhere
that answers a different question with its own rows.

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
src/app/data/              one module per view: one hook per section
src/app/ui/                the panel shapes every view shares
src/app/state/             the fetch, the query status, and the URL filter
src/app/api/v1/            one route per section, all through one handler
src/app/App.tsx            <AppShell config={config} />
```

A view and its module are one to one and share a name: the `market` view is
served by `panels/market.tsx`, and the `infrastructure` view by
`panels/infrastructure.tsx`. The directory listing is therefore a table of contents
for the console, which it was not when `panels/` also held a shared store and a
set of primitives. `tests/views.test.ts` fails if a view has no module, a module
has no view, or the two names drift apart.

A **view** holds several **sections**, and a section is a destination rather than
a filter:

| View             | Sections                                  |
| ---------------- | ----------------------------------------- |
| `market`         | `book`, `prices`, `venues`                |
| `infrastructure` | `nodes`, `headroom`, `providers`          |
| `settlement`     | `movements`, `runs`, `payouts`            |
| `slas`           | `commitments`, `at_risk`, `credits`       |
| `alerts`         | `feed`, `outages`, `capacity`, `security` |

The rail used to be built out of each view's group vocabulary — `ixp`,
`subsea_cable`, `breached` — which is a second way of doing what the summary bar's
chips already do, over the same rows, from the same single endpoint. It looked
like navigation and behaved like a filter, and an operator reading a rail of node
kinds reasonably concluded "Subsea cable" was a _place_ rather than a
_predicate_, then found it was also a chip in the other column.

So every section is a question with its own answer: its own endpoint, its own
rows, its own two columns. `market/book` and `market/prices` read the same two
tables and answer different questions about them, which is the test — if two
sections can be answered by the same rows with the same columns, they are one
section and the rail is lying.

`CONSOLE_SECTIONS` in `@hewa/console-types` names them, `SECTION_TITLES` titles
them, and `consoleSectionPath` builds the path. `tests/views.test.ts` asserts
that every rail item's `section` is `${view}/${id}`, that every section has a
route, and that no two rail items in a view share an id.

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

Eleven of the sixteen sections filter; five do not.

| Section                    | Bar                          | As a control                     |
| -------------------------- | ---------------------------- | -------------------------------- |
| `alerts/*` (four)          | a count per severity         | filters by severity              |
| `infrastructure/nodes`     | a count per node kind        | filters by kind                  |
| `infrastructure/headroom`  | a count per node kind        | filters by kind                  |
| `settlement/movements`     | a count per settlement kind  | filters by kind                  |
| `settlement/runs`          | completed / failed           | filters by the derived pair      |
| `settlement/payouts`       | a count per status           | filters by status                |
| `slas/*` (three)           | a count per commitment state | filters by state                 |
| `market/*` (three)         | headline figures             | a summary — nothing to count     |
| `infrastructure/providers` | the figures                  | a summary — one row per provider |

The alerts section grew one of these by hand and the others had nothing, so a
section either had a summary or had no way to say what it was showing before you
scrolled. `tests/summary.test.ts` asserts that all sixteen have one, and that the
eleven-and-five split is the split.

Build the chips with `summaryCounts`, which counts out of the rows, and pass
`keys` for the groups the section knows about. Those keys are no longer a constant
in the app: `meta.groups` comes from the service with the rows, so a group the
feed has nothing in still gets a chip at zero and can be pressed to say so.
Anything found in the data is counted whether or not it is in `keys` — the
settlement feed names an `escrow` kind and holds no escrow, which is the case
that keeps a bar from losing a control the operator can no longer find.

The four sections sharing a vocabulary each assert their own. `nodes` and
`headroom` are the same rows and the same node kinds; `feed`, `outages`,
`capacity` and `security` are four readings of the same alerts table and the same
severities. None of them can drop its bar without the others noticing, so
`tests/summary.test.ts` loops over all four and over both.

A chip is labelled from a shared `*_TITLES` map and keyed on the row's value, and
those are two different strings on purpose: `Data centre` on the chip, `data_center`
in the query string, and `NODE_KIND_TITLES[node.kind]` is what joins them. A
label the panel derived by upper-casing the first letter of the key said
`Data_center`, which is the wire format wearing a display's clothes.

### When a bar is a filter

A bar is a filter where it is a breakdown of the rows below it, and only there.
That is the whole rule, and it is per section, so `tests/filters.test.ts` asserts
it for all sixteen: nothing in a summary bar says what its rows are grouped by, so
there is otherwise no way to tell from reading a panel whether the section that
should have been a filter was left as a summary.

The five exclusions are checkable rather than a matter of taste. Three `market`
sections hold figures with no list attached, so a press could narrow nothing and
a filter there would be a control that changes nothing. `infrastructure/providers`
is one row per provider, so a chip keyed on the column it is keyed on would select
the row it was built from.

`settlement/runs` is the interesting one, because it has no `meta.groups` and is a
filter anyway. A run has no status of its own — a batch is a mix of completed and
failed lines — so its vocabulary is the derived pair the panel names **outright**:

```tsx
summaryCounts(rows, (row) => (row.failed > 0 ? "failed" : "completed"), {
  keys: RUN_STATES,
});
```

Deriving the pair from the rows instead is what the vocabulary rule forbids: a run
currently holding no failed line would lose its `failed` chip, and a control that
appears and disappears with the data is a control that is only sometimes there.

Where the bar is a filter, the chips are `FilterToggle`s in a `FilterBar`: a
press narrows the list, a second press takes it off, and two presses in a row
show both. A bar where the last chip wins reads as a dropdown that has forgotten
it is multi-select. Nothing selected shows everything — `visibleBy` is the one
place that decides, and the rule is that an empty selection is the whole list,
because a filter that empties itself when its last chip comes off is a view the
operator cannot get out of.

No section has a second control. The flights section used to: a carrier chip said
how many there were and a search box said which one you meant, and the bar had to
become one or the other because a strip of five toggles beside a text field has no
room for either. That arrangement cost `SummaryBar` a state machine, a second set
of controls and a second copy of the filters, all of it for one view. A callsign
was a column in the table, and the rows were the list to look a name up in.

The rail absorbed the other half of that decision. "Subsea cable" used to be a
rail button and now it is a chip, because a rail built out of the vocabulary it
was meant to navigate by cannot also be a filter — and it was both at once.

A chip toggles on its **key**, not its label, and `summaryCounts` therefore
carries the key it counted on. A filter keyed on a display label is a filter
keyed on a string someone has to keep in step with the data by hand.

### The filter is in the URL

The state behind those chips is in the query string, not in a `useState` in the
panel. A filter is the one piece of a panel's state an operator needs twice: once
while looking at the list, and once after sending the link to somebody else. In
component state the second copy does not exist, so the conversation becomes
"which severity was that" and somebody reads the counts aloud.

It is the same decision the shell already makes about the view, the panel widths
and the theme, through the same `nuqs` and the same `NuqsAdapter` in
`providers.tsx`. `state/filter.ts` holds the mechanism and nothing else: which
groups a section filters on, and under which key, belong to that section's panel.
It is the only hook in `state/`, and it is a filter — the text search that sat
beside it went with the flights view's search box.

Each key is the section's own, with the view's separator flattened:

| Key                       | Held by                              |
| ------------------------- | ------------------------------------ |
| `alerts-feed`             | `alerts/feed` severity chips         |
| `alerts-outages`          | `alerts/outages` severity chips      |
| `alerts-capacity`         | `alerts/capacity` severity chips     |
| `alerts-security`         | `alerts/security` severity chips     |
| `infrastructure-nodes`    | `infrastructure/nodes` kind chips    |
| `infrastructure-headroom` | `infrastructure/headroom` kind chips |
| `settlement-movements`    | `settlement/movements` kind chips    |
| `settlement-runs`         | `settlement/runs` state chips        |
| `settlement-payouts`      | `settlement/payouts` status chips    |
| `slas-commitments`        | `slas/commitments` state chips       |
| `slas-at-risk`            | `slas/at_risk` state chips           |
| `slas-credits`            | `slas/credits` state chips           |

Two levels of naming, both of which were bugs before they were rules.

**Not the view.** `infrastructure` and `settlement` both group their rows by
_kind_, and a shared `?kind=` would carry the settlement section's `escrow` into
the infrastructure one, match no node, and show an empty list with no chip pressed
— a filter nobody set and nobody can see to clear.

**Not the property.** Four sections filter on severity and four on state, so a
view-scoped `?slas=` cannot hold `slas/at_risk`'s filter and `slas/credits`'s
apart; arriving at one with the other's filter in the URL would filter a list the
operator never touched. And two sections of the same view over the same rows —
`nodes` and `headroom` — are two destinations with two filters, because arriving
at headroom is a fresh look at the network's room, not the node list with
something on it.

`tests/filters.test.ts` asserts both directions: `?settlement-movements=payout`
does not filter `infrastructure/nodes`, and `?infrastructure-nodes=ixp` does not
filter `infrastructure/headroom`.

Three details of the URL are deliberate:

- **An empty selection removes the key.** Not `?alerts-feed=`; an unfiltered
  console has the URL it had before anything was filtered, and a key left
  sitting there empty is the first thing anyone hand-cleans off a link before
  sending it.
- **History is `replace`**, which is nuqs' default and what the shell's own state
  does. The console keeps one history entry for the page, not one per press. The
  URL is an address to send, not a trail through what was pressed.

A key naming a group the section does not have filters to nothing and says so in
the empty state, rather than being quietly ignored. The URL said something; showing
a list that disagrees with the address bar is the one thing an address bar must
never do.

Four attributes make the rule assertable without reading a panel: the bar is
`[data-summary-bar]`, a bar that filters adds `data-filterable`, and each chip
is `[data-summary-item]` with the key in it and `aria-pressed` on it. A row the
filter acts on is `[data-row]`. The last one is not a convenience: the list is a
set of `<article>`s in some sections and a `<tr>` in others, and a test that
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

`App.tsx` has no logic in it and is not supposed to grow any. Adding a view means
adding an entry to `shell.config.tsx` and a module beside it; adding a section
means a rail item, a hook, a panel and a route. None of it means editing a layout
component or adding a `case` to a switch.

The view id, the section id and the panel collapse state are mirrored into the
query string, so a link reopens the console on the panel it was copied from. The
section is keyed **per view** — `?section.alerts=security`, `?section.market=book` —
because one `?section=` cannot hold where you were in two views at once, so a tab
you had put on the third button reopened on the first. The value is the bare id
rather than the full `alerts/security` key, because the key already carries the
view and writing it again would make `resolveItem` fall through to the first item
on every link. `tests/shell.test.ts` asserts both halves.

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
`tests/filters.test.ts` mounts a section's main column and presses its chips,
`tests/shell.test.ts` asks which rail button the shell marks as current,
`tests/query.test.ts` watches a query move from pending to ready, and
`tests/overlays.test.ts` asks whether Escape closes a dropdown. Everything else
stays in node, where SSR is what it should be tested in.

Both of the panel tests reach a panel **through the rail item that opens it**:

```ts
const section = (key: ConsoleSectionKey): ReactElement => {
  for (const spec of Object.values(config.views)) {
    const item = spec.rail.find((entry) => entry.section === key);
    if (item !== undefined) return createElement(item.main.render);
  }
  throw new Error(`no rail item for ${key}`);
};
```

Through the config rather than by importing the panel directly, so a section whose
rail item points at the wrong panel fails the test rather than quietly counting
the rows of its neighbour. Both helpers assert the whole registry: every section
in `CONSOLE_SECTION_KEYS` has a rail item, and every fixture has a section, so a
seventeenth section cannot be added without being classified as a filter or a
summary and given a fixture.

`tests/shell.test.ts` reads `aria-current="page"` off the rail rather than
`aria-pressed`. These buttons navigate, and a toggle marker would claim "I am on"
where a destination marker says "you are here" — and a rail that highlights the
wrong button while marking the right one still sends the reader to the wrong
destination.

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

`src/app/state/query.ts` is the boundary. `useConsoleSection` takes a section key,
asks for that section's own path — through `consoleSectionPath` from
`@hewa/console-types`, and _relatively_, so the browser calls this app — checks
the envelope's `code`, and returns one `SectionState`:

```ts
{
  status: ("pending" | "failed" | "ready", data, groups, refetch);
}
```

The status is a real question rather than a flag derived from a length. A section
that fails to load is not a section with zero rows, and `emptyMessage(status, …)`
keeps those two apart in the empty state: pending reads as loading, failure
reads as failure with a retry, and only a ready section with no matching rows
claims there is nothing to show. `tests/query.test.ts` asserts all three, and
asserts that a failure alongside a filter in force still blames the service —
clearing a filter that was never the problem is the wrong first move.

The React Query key is `["console", section]`, the section and not the view. Two
sections of one view are two reads, so keying by view would hand
`alerts/feed` whatever `infrastructure/nodes` last answered with.

The fetch is relative, so there is no base URL in this app. The browser asks its
own origin for `/api/v1/alerts/feed`, a route handler under `src/app/api/v1/`
answers, and that handler is the only place in the app that knows `central-api`
exists: it reads `CENTRAL_API_URL` and `CENTRAL_API_SERVICE_TOKEN` from the
_server's_ environment and forwards the request with the token attached. Neither
value is `NEXT_PUBLIC_`, so neither is inlined into the client bundle, and the
service is not reachable from a browser at all. `tests/query.test.ts` asserts the
request is a bare path with no host in front of it, and that it carries no
`authorization`, no `cookie` and no service token.

One function describes the whole route. `consoleSectionPath` builds
`/api/v1/{view}/{section}`, the browser sends it, this app forwards
`CENTRAL_API_URL + consoleSectionPath(view, section)`, and `central-api`
registers `@Controller("api/v1")` with a `Get` per section — so the path a panel
asks for and the path the service answers are the same string, and a rename that
moved one without the other fails a test rather than returning a 404.

Sixteen route files, one per section, all six lines long and all built by
`_handlers.ts`, and no `[...path]` catch-all. A catch-all would be an open relay
with a token attached, forwarding whatever it was handed, including routes nobody
reviewed. Each file exports only a `GET`; the surface is read-only, so a `POST`
gets Next's own 405 and the service is never asked. The service's token guard is
what makes the claim true rather than decorative — a proxy hides the address and
the token, but CORS is enforced by browsers and not by the service, so a `curl`
would get a 200 from an unguarded `/api/v1`.

`src/app/data/` is still one module per view and still named after it, but a
module is now the seam between a panel and the network rather than a file of
records. Each exports its row types and **one hook per section**, and nothing else:

```
src/app/data/market.ts          useMarketBook, usePriceHistory, useVenues
src/app/data/infrastructure.ts  useNodes, useHeadroom, useProviders
src/app/data/settlement.ts      useMovements, useRuns, usePayouts
src/app/data/slas.ts            useCommitments, useAtRisk, useCredits
src/app/data/alerts.ts          useAlertFeed, useOutages, useCapacityPressure, useSecurityEvents
```

One hook per section rather than one per view, because a rail button is a
destination with its own endpoint now. A single `useMarket` that fetched all three
market sections would be a second place where "what is on screen" is decided.

No runtime record arrays, no group constants. `tests/data.test.ts` fails if a
module exports a value that is not a function, because a module that still
carries its own records has stopped being the thing it claims to be and the
panel will read one while the test reads the other.

The hooks return one of two shapes, and which one is a real distinction rather
than a convention:

- `RowState` / `GroupedRowState` for a list. `rows` is `[]` while pending, which
  is honest: a list that has not loaded is legitimately empty.
- `DocumentState` for the three `market` sections, whose `data` is
  `T | undefined`. A zeroed market document is a plausible lie — a spread of zero
  says a market is not trading rather than that it has not answered.

`groups` is `meta.groups` from the response and not the set of values the rows
happen to hold, so a chip can be pressed on a severity no row currently belongs to
and still be there afterwards. That is the case the fixtures exist for: four of
them carry a group with nothing in it.

The document also has to stay in one currency. A book with a USD price point and
a USDC one cannot be summed, ranked or averaged into a headline figure, so the
service refuses the mixed book rather than picking one. `tests/query.test.ts`
asserts both the undefined document and the panel reading `undefined` as a dash
rather than as a zero.

`MarketBook` has no `spread` field, and its absence is deliberate. Global best bid
and best offer come from different pools priced in different units, so their
difference is not a spread — it is the difference between two numbers that do not
measure the same thing. Computing one in the browser is inventing a figure the
service declined to publish.

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

### Money on the way out

A price, a spread and a headline figure are all `Money` — an integer count of a
currency's minor units, rendered through `formatMoney` from
`@hewa/marketplace-types`. Nothing in the console divides by a hundred to get
dollars back, because a figure that has been through a `float` has lost the
property that made it worth formatting in the first place: that it compares
equal to itself. Utilisation and availability are basis points for the same
reason, and the panels format them with `formatBps`.

The venues panel reads the same `VenueShare` breakdown the service derived the
figure from, so a row cannot disagree with the bar above it. A venue with no rows
still has a share, and its figures read `No capacity` rather than nothing — an
empty panel is not the same claim as a panel saying the venue is empty.

SLA figures are not money and are never rendered as any. A shortfall is basis
points off a target and a credit is a whole number of points computed by
`creditablePoints`, both from `@hewa/marketplace-types`. A panel that turned a
shortfall into a currency figure would be pricing a reliability miss at a rate
nobody agreed to, and it would do it in a `float`.
