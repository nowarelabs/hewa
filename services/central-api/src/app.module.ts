import { Module } from "@nestjs/common";
import { ApiV1Module } from "./api-v1/api-v1.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [ApiV1Module, HealthModule],
})
export class CentralApiAppModule {}
