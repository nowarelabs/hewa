import { Module } from "@nestjs/common";

import { AlertsWriteController } from "./alerts/alerts.write.controller.js";
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
 */
@Module({
  // Provided globally by the view modules' root import, listed here because the
  // `@UseGuards` in these controllers is a dependency on it and a dependency that
  // only works because something else happened to import it is not one.
  imports: [ServiceAuthModule],
  controllers: [
    AlertsWriteController,
    MonitorsWriteController,
    NodesWriteController,
    OrdersWriteController,
    SettlementsWriteController,
    SpotsWriteController,
  ],
  providers: [
    AlertsWriteService,
    MonitorsWriteService,
    NodesWriteService,
    OrdersWriteService,
    SettlementsWriteService,
    SpotsWriteService,
  ],
})
export class DataWritesModule {}
