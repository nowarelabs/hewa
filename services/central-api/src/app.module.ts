import { Module } from "@nestjs/common";
import { ConsoleModule } from "./console/console.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [ConsoleModule, HealthModule],
})
export class CentralApiAppModule {}
