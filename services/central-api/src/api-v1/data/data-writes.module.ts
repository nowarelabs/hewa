import { Module } from "@nestjs/common";

import { AlertsWriteController } from "./alerts/alerts.write.controller.js";
import { AttestationsWriteController } from "./finance/attestations.write.controller.js";
import { AttestationsWriteService } from "./finance/attestations.write.service.js";
import { BillsWriteController } from "./finance/bills.write.controller.js";
import { BillsWriteService } from "./finance/bills.write.service.js";
import { CreditsWriteController } from "./finance/credits.write.controller.js";
import { CreditsWriteService } from "./finance/credits.write.service.js";
import { LedgerEntriesWriteController } from "./finance/ledger-entries.write.controller.js";
import { LedgerEntriesWriteService } from "./finance/ledger-entries.write.service.js";
import { PayoutsWriteController } from "./finance/payouts.write.controller.js";
import { PayoutsWriteService } from "./finance/payouts.write.service.js";
import { AlertsWriteService } from "./alerts/alerts.write.service.js";
import { MonitorsWriteController } from "./monitors/monitors.write.controller.js";
import { MonitorsWriteService } from "./monitors/monitors.write.service.js";
import { NodesWriteController } from "./nodes/nodes.write.controller.js";
import { NodesWriteService } from "./nodes/nodes.write.service.js";
import { OrdersWriteController } from "./orders/orders.write.controller.js";
import { OrdersWriteService } from "./orders/orders.write.service.js";
import { ServiceAuthModule } from "../service-auth.module.js";
import { SettlementsWriteController } from "./settlements/settlements.write.controller.js";
import { SettlementsWriteService } from "./settlements/settlements.write.service.js";
import { SpotsWriteController } from "./spots/spots.write.controller.js";
import { SpotsWriteService } from "./spots/spots.write.service.js";

/**
 * Everything under `/api/v1/data` — the six writable tables and nothing else.
 *
 * One module rather than six, and that is a change from the view modules beside it.
 * Those are six because a view is read in several shapes and each shape is its own
 * question; here every resource answers the *same* five verbs, so a module per
 * resource would be six files whose only content is a one-line `@Module`, and the
 * registry — the part worth reading — would be spread across six of them.
 *
 * The controllers and services are still listed out by hand, because this list is
 * the thing Nest can construct and a list built with `map` at import time is a list
 * whose contents depend on an import from another package.
 *
 * ## Worth reading against `CONSOLE_WRITE_RESOURCES`
 *
 * The order here is alphabetical, which is neither the contract's order nor the tab
 * order, and the differences between the six are the interesting part:
 *
 * | Resource     | Create | Read one | Replace/upsert | Patch | Delete |
 * | ------------ | ------ | -------- | -------------- | ----- | ------ |
 * | `alerts`     | ✓      | ✓        | ✓ `PUT /:id`   | ✓     | —      |
 * | `nodes`      | ✓      | ✓        | ✓ `PUT /:id`   | ✓     | ✓      |
 * | `orders`     | ✓      | ✓        | ✓ `PUT /:id`   | ✓     | ✓      |
 * | `spots`      | ✓      | ✓        | ✓ `PUT`        | ✓     | —      |
 * | `settlements`| ✓      | ✓        | ✓ `PUT /:id`   | ✓     | —      |
 * | `monitors`   | ✓      | ✓        | ✓ `PUT /:id`   | ✓     | —      |
 *
 * `spots` is the odd one twice over: its id is generated, so its upsert matches on
 * `(pool, observedAt)` with no id in the path, and it is the only resource here whose
 * create has no id in the body either.
 *
 * A seventh resource added to the contract with no controller here is a panel whose
 * editor posts to a 404 — and the e2e test walks the contract's list, so it fails
 * there first.
 *
 * ## The five finance resources, and why their verb rows are empty
 *
 * The table above is the console's, and it is the console's because the console holds
 * operational data: alerts, nodes and orders are things an operator creates, and a
 * mistake in one is a row to edit. Finance holds money, or the record of money, and
 * each verb is decided by what the thing *is*:
 *
 * | Resource         | Create | Patch | What is refused instead, and what replaces it |
 * | ---------------- | ------ | ----- | --------------------------------------------- |
 * | `bills`          | —      | ✓     | an invoice is not typed in, re-priced or removed |
 * | `credits`        | ✓      | —     | a credit is not a state, so there is nothing to move |
 * | `payouts`        | —      | ✓     | an obligation is produced by settling a bill |
 * | `ledger_entries` | ✓      | —     | an entry is corrected by a second, reversing entry |
 * | `attestations`   | ✓      | —     | a day's revenue is published or it is not there |
 *
 * `bills` and `payouts` are patch-only because their status is a lifecycle and their
 * money is not editable; the other three are create-only because they are records,
 * and `finance_ledger_entries` has no `updatedAt` at all because there is no second
 * value for it to hold. The refusals are the design — see each controller.
 */
@Module({
  // Provided globally by the view modules' root import, listed here because the
  // `@UseGuards` in these controllers is a dependency on it and a dependency that
  // only works because something else happened to import it is not one.
  imports: [ServiceAuthModule],
  controllers: [
    AlertsWriteController,
    AttestationsWriteController,
    BillsWriteController,
    CreditsWriteController,
    LedgerEntriesWriteController,
    MonitorsWriteController,
    NodesWriteController,
    OrdersWriteController,
    PayoutsWriteController,
    SettlementsWriteController,
    SpotsWriteController,
  ],
  providers: [
    AlertsWriteService,
    AttestationsWriteService,
    BillsWriteService,
    CreditsWriteService,
    LedgerEntriesWriteService,
    MonitorsWriteService,
    NodesWriteService,
    OrdersWriteService,
    PayoutsWriteService,
    SettlementsWriteService,
    SpotsWriteService,
  ],
})
export class DataWritesModule {}
