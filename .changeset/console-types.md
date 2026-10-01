---
"@hewa/console-types": minor
---

Add the wire contract for the operations console's data, and retarget it at the
bandwidth marketplace.

- `ConsolePayload` maps each of the five console views to the envelope its
  endpoint answers with, and `CONSOLE_VIEWS` is the runtime list the two can be
  checked against. `consolePath` is the only place a console URL is written down,
  because the app builds one with it and the service's tests assert a route
  against it. The views are `market`, `infrastructure`, `settlement`, `slas` and
  `alerts`.
- `meta.groups` carries the group vocabulary with the rows, including groups no
  row currently holds, so a summary bar can offer a filter at zero rather than
  losing the control until the data moves. `market` is the exception: it counts
  figures and draws an order book rather than filtering a list, so its group list
  is typed `never` and an empty group vocabulary is the only thing it compiles
  to.
- The vocabularies are exported as runtime lists rather than left to each consumer
  to write down again: `MARKET_POOL_TITLES`, `NODE_KINDS`, `NODE_STATUSES`,
  `NODE_KIND_TITLES`, `SETTLEMENT_KINDS`, `SETTLEMENT_KIND_TITLES`,
  `ALERT_SEVERITIES`, `ALERT_SEVERITY_TITLES` and `ALERT_CATEGORIES`. Each
  `*_TITLES` map is keyed by the **value** a row carries, not by the enum member
  name, so a chip reads `Data centre` while the filter is keyed on `data_center`.
- `MarketSection` carries the per-pool figures behind a rail tab, so a tab with no
  rows behind it still opens a panel that says what the pool has rather than
  nothing. `SpotPoint` names the `pool` it belongs to, which is what lets one
  chart draw a line per pool.
