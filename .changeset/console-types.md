---
"@hewa/console-types": minor
---

Add the wire contract for the operations console's data, and retarget it at the
bandwidth marketplace.

- `ConsolePayload` maps each of the **sixteen console sections** to the envelope its
  endpoint answers with, and `CONSOLE_SECTION_KEYS` is the runtime list the two can
  be checked against. `consoleSectionPath` is the only place a console URL is
  written down, because the app builds one with it and the service's tests assert
  a route against it. A rail button is a **destination, not a filter**: each section
  has its own endpoint, its own rows and its own two columns, and the test for
  that is whether two sections can be answered by the same rows with the same
  columns — if so they are one section and the rail is lying. The sections are
  `market/{book,prices,venues}`, `infrastructure/{nodes,headroom,providers}`,
  `settlement/{movements,runs,payouts}`, `slas/{commitments,at_risk,credits}` and
  `alerts/{feed,outages,capacity,security}`, across the five views `market`,
  `infrastructure`, `settlement`, `slas` and `alerts`.
- `CONSOLE_SECTIONS`, `SECTION_TITLES` and `parseSectionKey` name, title and take
  apart a section key. `MarketBook` has no `spread` field: global best bid and best
  offer come from different pools priced in different units, so their difference is
  not a spread, and computing one is publishing a figure the service declined to.
- `meta.groups` carries the group vocabulary with the rows, including groups no
  row currently holds, so a summary bar can offer a filter at zero rather than
  losing the control until the data moves. `market` is the exception: it counts
  figures and draws an order book rather than filtering a list, so its group list
  is typed `never` and an empty group vocabulary is the only thing it compiles
  to.
- The vocabularies are exported as runtime lists rather than left to each consumer
  to write down again: `MARKET_POOL_TITLES`, `NODE_KINDS`, `NODE_STATUSES`,
  `NODE_KIND_TITLES`, `SETTLEMENT_KINDS`, `SETTLEMENT_KIND_TITLES`,
  `ALERT_SEVERITIES`, `ALERT_SEVERITY_TITLES`, `ALERT_CATEGORIES` and
  `ALERT_CATEGORY_TITLES`. Each `*_TITLES` map is keyed by the **value** a row
  carries, not by the enum member name, so a chip reads `Data centre` while the
  filter is keyed on `data_center`. An alert's category decides who gets paged, so
  its label is read by whoever is on that rota rather than by whoever built the
  table — which is why `billing` is spelled out rather than abbreviated.
- `MarketSection` carries the per-pool figures behind a rail tab, so a tab with no
  rows behind it still opens a panel that says what the pool has rather than
  nothing. `SpotPoint` names the `pool` it belongs to, which is what lets one
  chart draw a line per pool.
