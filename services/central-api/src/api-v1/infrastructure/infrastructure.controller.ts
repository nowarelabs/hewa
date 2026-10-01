import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { InfrastructureService } from "./infrastructure.service.js";

/**
 * `api/v1/infrastructure/{nodes,headroom,providers}`.
 *
 * The return types are `ConsolePayload["infrastructure/nodes"]` and its siblings,
 * so a field renamed in the shared contract is a build failure here rather than an
 * `undefined` in a panel.
 *
 * The three sections share a table and none of them shares a payload: `headroom`
 * derives a column the nodes table does not have, and `providers` groups rows
 * into rows about something else entirely. One endpoint returning all three would
 * be a document two of them have to receive in order to use their own half.
 */
@Controller(`${API_V1_PREFIX}/infrastructure`)
@UseGuards(ServiceTokenGuard)
export class InfrastructureController {
  constructor(private readonly service: InfrastructureService) {}

  @Get("nodes")
  async nodes(): Promise<ConsolePayload["infrastructure/nodes"]> {
    return this.service.readNodes();
  }

  @Get("headroom")
  async headroom(): Promise<ConsolePayload["infrastructure/headroom"]> {
    return this.service.readHeadroom();
  }

  @Get("providers")
  async providers(): Promise<ConsolePayload["infrastructure/providers"]> {
    return this.service.readProviders();
  }
}
