import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { AlertsService } from "./alerts.service.js";

/**
 * `api/v1/alerts/{feed,outages,capacity,security}`.
 *
 * Four routes over one table, and the three that are not `feed` are grouped
 * rollups. `outages` and `capacity` both filter on `category`, which is what makes
 * them sections rather than chips: the grouping, the worst-severity rollup and the
 * join to the node's current headroom cannot be reproduced by the client from the
 * feed, and a rail that asks the server to do it is a rail item that navigates.
 *
 * The return types are the `ConsolePayload` entries, so a field renamed in the
 * contract fails the build here rather than arriving as `undefined` in a panel.
 */
@Controller(`${API_V1_PREFIX}/alerts`)
@UseGuards(ServiceTokenGuard)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get("feed")
  async feed(): Promise<ConsolePayload["alerts/feed"]> {
    return this.service.readFeed();
  }

  @Get("outages")
  async outages(): Promise<ConsolePayload["alerts/outages"]> {
    return this.service.readOutages();
  }

  @Get("capacity")
  async capacity(): Promise<ConsolePayload["alerts/capacity"]> {
    return this.service.readCapacity();
  }

  @Get("security")
  async security(): Promise<ConsolePayload["alerts/security"]> {
    return this.service.readSecurity();
  }
}
