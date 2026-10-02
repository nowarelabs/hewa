---
"@hewa/console-types": minor
---

Add the write half of the operations console's contract: the payloads for the six
writable resources, and the two registries that say which of them exist.

- `ConsoleWriteResource` is `alerts | nodes | orders | spots | settlements |
monitors`, with `CONSOLE_WRITE_RESOURCES` as its runtime list, so a proxy can
  check a path segment against it instead of forwarding whatever it was handed.
  `DeletableWriteResource` and `DELETABLE_WRITE_RESOURCES` name the **two** that
  may be removed — `nodes` and `orders`. An alert, a settlement line and a
  monitored commitment are records of things that happened; deleting one does not
  correct it, it erases it, and an erased movement is indistinguishable from one
  that was never paid. The distinction lives here rather than in each client so
  the answer is the same everywhere.
- `AlertWrite`, `NodeWrite`, `OrderWrite`, `SpotWrite`, `SettlementWrite` and
  `MonitorWrite` are the whole record each `PUT` replaces, with `*Create` and
  `*Patch` beside them. Amounts are **minor units of the currency**, whole and
  exact — a `PATCH` body carries `priceMinor` rather than a `Money`, because the
  object form exists for a table to draw and a write has no second column to put a
  currency in.
- `SpotRecord` is the one write whose key is not its id: a spot is
  `(pool, observedAt)` and its integer id is generated, so the upsert is addressed
  by the natural key the body carries and `PUT /data/spots` takes no id. The read
  side leaves the id out of `MarketQuote` for the same reason — a panel drawing a
  chart has no use for it.
- A monitor's `state` is **not** in `MonitorWrite`. It is derived from the four
  basis-point columns by the service, and a browser that could write the word
  "compliant" could declare a commitment met. The credit is an exact
  `numerator`/`denominator` pair and the shortfalls are basis points, so a form
  never has to round a figure that decides whether money is owed.
- `WRITE_ID_PREFIXES` carries the prefix each resource's ids are written with —
  `ord-`, `nod-`, `alt-`, `stl-`, `sla-`, `spot-`. The columns are `varchar(64)`
  primary keys with **no default**, so a create names its own row: there is no key
  generator behind the service, and a client that had none would either ask an
  operator to invent a UUID or discover the absence as `expected string, received
undefined` at `id`. It is a convention rather than a constraint, taken from the
  seed data, so a client with an id of its own can still use it.
- `ConsoleWriteRecords` maps each resource to the record it holds, which is what
  lets a client key a result by resource and stay honest about the six shapes
  rather than casting one to another. It is an interface rather than a list because
  nothing iterates it — a client indexes it with the resource it was handed.
