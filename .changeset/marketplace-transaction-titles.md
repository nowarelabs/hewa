---
"@hewa/marketplace-types": minor
---

Add `TRANSACTION_STATUS_TITLES`, keyed by the status value rather than the member
name.

`TRANSACTION_STATUSES` is the vocabulary a settlement section builds its payout
chips from, and a chip has to be written for a reader: `processing` rendered as
`processing` is the wire format leaking into a status column, and rendering it as
`Processing` while the row says `processing` is only right if the map is keyed by
the value. Keyed by the member name it would read `Failed` for two of the five and
`Reversed` for three, which is a coincidence rather than a decision.

A payout's filter is keyed on `failed`, so a map keyed any other way comes back
`undefined` on every row and the status column says nothing at all — a blank
rather than an error. The map is a `Record<TransactionStatus, string>`, so a
status added to `TRANSACTION_STATUSES` without a title is a compile error, and the
package's tests assert both directions: every status has a distinct title, and
none of them is itself the wire value.
