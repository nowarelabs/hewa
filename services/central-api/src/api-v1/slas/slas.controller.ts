import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ConsolePayload } from "@hewa/console-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { SlasService } from "./slas.service.js";

/**
 * `api/v1/slas/{commitments,at_risk,credits}`.
 *
 * Three routes over one table, each answering a different question: what is
 * monitored, what is about to fail, and what failing would cost. The third carries
 * no `Money` — see `SlasService.readCredits` for why a credit rate is published
 * without the bill it applies to.
 */
@Controller(`${API_V1_PREFIX}/slas`)
@UseGuards(ServiceTokenGuard)
export class SlasController {
  constructor(private readonly service: SlasService) {}

  @Get("commitments")
  async commitments(): Promise<ConsolePayload["slas/commitments"]> {
    return this.service.readCommitments();
  }

  @Get("at_risk")
  async atRisk(): Promise<ConsolePayload["slas/at_risk"]> {
    return this.service.readAtRisk();
  }

  @Get("credits")
  async credits(): Promise<ConsolePayload["slas/credits"]> {
    return this.service.readCredits();
  }
}
