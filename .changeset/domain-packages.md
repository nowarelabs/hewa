---
"@hewa/marketplace-types": minor
"@hewa/billing-domain": minor
"@hewa/settlement-domain": minor
"@hewa/crypto": minor
"@hewa/ledger-accounting": minor
"@hewa/telco-integrations": minor
---

Add the six domain packages behind rating, invoicing, settlement, and the
ledger.

- `@hewa/marketplace-types` holds the vocabulary the rest of the system shares:
  `Money` as an integer count of a currency's minor units, SLA commitments,
  bandwidth and ISP records, and the marketplace transaction lifecycle.
- `@hewa/billing-domain` prices a month: a commitment billed whether or not it is
  used, overage on sustained average use above that commitment, and an SLA credit
  assessed on whole percentage points missed. The credit is computed against the
  pre-credit basis, so a large credit cannot reduce its own basis and cascade.
- `@hewa/settlement-domain` turns what an ISP is owed into a payout: a quote
  taken once and recorded for audit, an expired quote refused, an idempotency key
  derived from the payout rather than generated, and duplicate bill references
  rejected so a retried run cannot pay twice.
- `@hewa/crypto` wraps stablecoin operations behind an interface, with an
  in-memory wallet for tests, and exposes the Ethers checks needed to refuse a
  malformed address. Quotes are exact `numerator / denominator` pairs with an
  explicit expiry, never a decimal.
- `@hewa/ledger-accounting` is double-entry: balanced journal entries, normal-side
  balances, raw signed balances, trial balances, and templates for the entries
  billing posts. An entry whose sides do not sum is refused rather than posted.
- `@hewa/telco-integrations` adapts ISP billing and OSS suites behind one
  interface, taking its HTTP client as a constructor argument so the tests run
  with no network and no credentials. A vendor's error body is not propagated
  into an exception, because it can carry customer data.

`@hewa/proto` gains `hewa.common.v1.Money` alongside the metering, billing,
settlement, and provisioning event schemas.
