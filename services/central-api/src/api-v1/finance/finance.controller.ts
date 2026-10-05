import { Controller, Get, UseGuards } from "@nestjs/common";
import type { FinancePayload } from "@hewa/financial-dashboard-types";

import { API_V1_PREFIX } from "../prefix.js";
import { ServiceTokenGuard } from "../service-token.guard.js";
import { FinanceService } from "./finance.service.js";

/**
 * `api/v1/finance/{view}/{section}`, six routes over one service.
 *
 * ## Why the paths are two segments and not six flat ones
 *
 * Because the section ids repeat across views — a `ledger` view whose section is also
 * called `ledger`, a `payouts` section under `settlement` — and a flat namespace would
 * force one of them to be renamed to keep a path unique. The pair also carries the
 * grouping: a tab is a question, and `revenue/bills` and `revenue/receivables` are two
 * answers to it, so the view in the path is the thing being asked about.
 *
 * ## Why there is no `:section` parameter, and what holds the six down
 *
 * Because a parameter would accept any string, and an unknown section would then be a
 * 404 from Nest's router rather than a route that does not exist. What holds this list
 * to the contract is the pair of return types below: each handler answers
 * `FinancePayload["view/section"]`, so a section added to
 * `@hewa/financial-dashboard-types` without a read here is a *route* the app can ask
 * for and this controller does not answer, which the e2e suite catches by walking
 * `FINANCE_SECTION_KEYS` and asking for each path — a path from the contract with no
 * route is a 404 the test reports against the key, not a passing build.
 *
 * The return types are the contract's own payload entries, so a field renamed in
 * `@hewa/financial-dashboard-types` fails here instead of arriving as `undefined` in a
 * panel.
 */
@Controller(`${API_V1_PREFIX}/finance`)
@UseGuards(ServiceTokenGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get("revenue/bills")
  async bills(): Promise<FinancePayload["revenue/bills"]> {
    return this.service.readBills();
  }

  @Get("revenue/receivables")
  async receivables(): Promise<FinancePayload["revenue/receivables"]> {
    return this.service.readReceivables();
  }

  @Get("revenue/credits")
  async credits(): Promise<FinancePayload["revenue/credits"]> {
    return this.service.readCredits();
  }

  @Get("settlement/payouts")
  async payouts(): Promise<FinancePayload["settlement/payouts"]> {
    return this.service.readPayouts();
  }

  @Get("ledger/ledger")
  async ledger(): Promise<FinancePayload["ledger/ledger"]> {
    return this.service.readLedger();
  }

  @Get("proof/attestations")
  async attestations(): Promise<FinancePayload["proof/attestations"]> {
    return this.service.readAttestations();
  }
}
