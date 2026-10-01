import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { InfrastructureService } from "./infrastructure.service.js";

/**
 * `api/v1/infrastructure`.
 *
 * Every node, and the group vocabulary that outlives the rows.
 *
 * One `@Get` and one delegation, awaited so a query failure is thrown from the
 * handler rather than floating out of it. The rows are selected in the service
 * because the
 * panel is not the only thing that asks this question — a settlement run, a test and
 * a future export all ask the same one — and a controller that assembled its own
 * answer would be a third place to keep it honest.
 *
 * The return type is `ConsolePayload["infrastructure"]`, so a field renamed in the shared
 * contract is a build failure here rather than an `undefined` in a panel.
 */
@Controller(`${API_V1_PREFIX}/infrastructure`)
@UseGuards(ServiceTokenGuard)
export class InfrastructureController {
  constructor(private readonly service: InfrastructureService) {}

  @Get()
  async infrastructure(): Promise<ConsolePayload["infrastructure"]> {
    return this.service.read();
  }
}
