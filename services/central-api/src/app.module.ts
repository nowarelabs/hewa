import { Module } from "@nestjs/common";

import { ApiV1Module } from "./api-v1/api-v1.module.js";
import { DbModule } from "./db/db.module.js";
import { HealthModule } from "./health/health.module.js";

/**
 * The service: a health route, the console read surface, and the connection both
 * read through.
 *
 * `DbModule` is imported here rather than by each view module. It is `@Global`, so
 * the five services inject `DB` without declaring it, and every one of them would
 * otherwise repeat an import of a module that exports one provider.
 *
 * It is still listed. A `@Global` module that is only ever reached through another
 * `@Global` module is invisible to anyone reading this file, and the connection is
 * the one dependency whose absence is worth seeing at the top.
 */
@Module({
  imports: [DbModule, ApiV1Module, HealthModule],
})
export class CentralApiAppModule {}
