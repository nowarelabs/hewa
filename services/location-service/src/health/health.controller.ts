import { Controller, Get } from "@nestjs/common";
import { ResponseCode } from "@hewa/response-codes";

@Controller("health")
export class HealthController {
  /**
   * Liveness and readiness in one stub, answering with the shared response
   * code so every surface in the workspace reports health the same way.
   */
  @Get()
  check(): { service: string; code: ResponseCode; status: "ok" } {
    return { service: "@hewa/location-service", code: ResponseCode.Ok, status: "ok" };
  }
}
