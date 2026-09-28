---
"@hewa/proto": minor
---

Add the domain event schemas for metering, billing, settlement, and
provisioning, plus `hewa.common.v1.Money`.

`Money` is an integer count of a currency's minor units rather than a double, and
an FX rate is an exact `numerator / denominator` pair with an explicit expiry.
These values are summed, compared for equality, and reconciled against a ledger,
and a `double` cannot do any of that without drifting.
