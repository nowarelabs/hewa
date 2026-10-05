import { Body, Controller, Param, Patch, UseGuards } from "@nestjs/common";
import type { PayoutPatch, PayoutRecord } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import { FINANCE_ID, payoutPatchSchema } from "./finance-write-schemas.js";
import { PayoutsWriteService } from "./payouts.write.service.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";

/**
 * `api/v1/data/payouts` — a `PATCH` and nothing else.
 *
 * ## Why no `POST`
 *
 * Because a payout obligation is not created by a dashboard; it comes from settling
 * a bill, which is `@hewa/settlement-domain`'s question and produces the row. A
 * `POST` here would be a way to owe an ISP money by typing, and the amount is
 * positive — an obligation — so the direction of the mistake would not be visible in
 * the body.
 *
 * And no `PUT`: the amount, the fee, the destination and the reference are all facts
 * about the obligation, and replacing them is not editing a payout, it is inventing
 * a second one with the same id. A wrong amount is settled and reversed.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/payouts`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class PayoutsWriteController {
  constructor(private readonly service: PayoutsWriteService) {}

  /**
   * `PATCH /api/v1/data/payouts/:id`.
   *
   * 404 when the id is not a payout. 422 when the move is not on the rail —
   * `assertPayoutTransition` from `@hewa/settlement-domain`, carrying `{ from, to }`
   * — and 422 with `failureReason` in `path` when the body marks a payout `failed`
   * with no reason, or attaches a reason to a payout that is not failed. The column
   * check would catch both, and a constraint violation is not a field error.
   */
  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(FINANCE_ID, "payout id")) id: string,
    @Body(new ZodBody(payoutPatchSchema, "payout patch")) body: PayoutPatch,
  ): Promise<PayoutRecord> {
    return this.service.patch(id, body);
  }
}
