import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@hewa/observability";
import { CentralApiAppModule } from "./app.module.js";
import { CentralApiErrorFilter } from "./common/error.filter.js";
import { corsDelegate } from "./config/cors.js";
import { loadEnv } from "./config/env.js";
import { loadLocalEnv } from "./config/local-env.js";

/**
 * Bootstrap. Everything below is wiring, and anything that looks like a decision
 * lives in a module instead — the CORS policy is `corsDelegate` in `./config`, so
 * the e2e suite can apply the real one rather than a copy of it that drifts.
 *
 * The `.env` is read first, and that ordering is the whole reason this call is
 * here rather than inside `loadEnv`: configuration is resolved before anything
 * reads it.
 */
loadLocalEnv();
const env = loadEnv();
const logger = createLogger({ service: env.service });

if (env.serviceToken === undefined) {
  // Announced here rather than left to be discovered by a 503 in a panel. The
  // service is up and `/health` is answering, so this is the moment where saying
  // so costs nothing and saves a debugging session: a console that loads and then
  // shows an error for every view has one cause, and it is a line of log rather
  // than something to infer from seven panels at once.
  logger.warn("no service token configured, so /api/v1 will answer 503", {
    variable: "CENTRAL_API_SERVICE_TOKEN",
    hint: "copy services/central-api/.env.example to .env",
  });
}

const app = await NestFactory.create(CentralApiAppModule, { logger: false });
app.useGlobalFilters(new CentralApiErrorFilter());
app.enableShutdownHooks();
app.enableCors(corsDelegate(env.corsOrigins));

await app.listen(env.port);
logger.info("service listening", {
  port: env.port,
  environment: env.environment,
  corsOrigins: env.corsOrigins,
});
