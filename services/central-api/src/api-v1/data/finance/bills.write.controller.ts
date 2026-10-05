import { Body, Controller, Param, Patch, UseGuards } from "@nestjs/common";
import type { Bill, BillPatch } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { BillsWriteService } from "./bills.write.service.js";
import { FINANCE_ID, billPatchSchema } from "./finance-write-schemas.js";

/**
 * `api/v1/data/bills` — a `PATCH` and nothing else.
 *
 * ## Why this is the shortest controller in the workspace, on purpose
 *
 * A bill is an invoice. It cannot be created here, replaced here, or deleted here,
 * and each absence is a statement about money rather than an unfinished route:
 *
 * - **`POST`** would let anyone holding the write token invoice a customer.
 * - **`PUT`** would let them re-price a month after the fact with nothing in the
 *   record saying the figure moved. A correction is a credit or a reversal.
 * - **`DELETE`** would remove the document a dispute is *about*. A bill that should
 *   not exist is `void`, which leaves the row, its reason and its date behind.
 *
 * The console's six resources each answer four verbs; this one answers one, and the
 * difference is the design rather than a gap in it.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/bills`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class BillsWriteController {
  constructor(private readonly service: BillsWriteService) {}

  /**
   * `PATCH /api/v1/data/bills/:id`.
   *
   * 404 when the id is not a bill. 422 when the move is not one a bill may make —
   * the table is `BILL_TRANSITIONS` in the contract, and the refusal carries
   * `{ from, to }` — and 422 with `disputeReason` in `path` when the body marks a
   * bill `disputed` without a reason, because that is the field the operator has to
   * fill in.
   *
   * The response is the whole bill rather than a delta, so the panel's row and the
   * section it was loaded from are the same object afterwards.
   */
  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(FINANCE_ID, "bill id")) id: string,
    @Body(new ZodBody(billPatchSchema, "bill patch")) body: BillPatch,
  ): Promise<Bill> {
    return this.service.patch(id, body);
  }
}
