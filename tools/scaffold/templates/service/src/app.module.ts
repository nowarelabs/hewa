import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
})
export class __CLASS__AppModule {}
