---
"@hewa/marketplace-types": minor
---

Add `SLA_STATE_TITLES`, keyed by the state value rather than the member name.

`SLA_STATES` is the vocabulary a console builds its SLA chips and rail tabs from,
and a chip has to be written for a reader: `at_risk` rendered as `at_risk` is the
wire format leaking into the UI, and rendering it as `AT_RISK` means the label was
built from the member name instead of from the value the row carries. The titles
live beside the list rather than in each panel, so the second panel to need them
does not write a second copy.

The map is a `Record<SlaState, string>`, so a state added to `SLA_STATES` without a
title is a compile error, and a title keyed by a value no row holds is an entry
nothing can reach. Both directions are asserted in the package's own tests.
