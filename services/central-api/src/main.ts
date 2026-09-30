import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@hewa/observability";
import { CentralApiAppModule } from "./app.module.js";
import { CentralApiErrorFilter } from "./common/error.filter.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const logger = createLogger({ service: env.service });

const app = await NestFactory.create(CentralApiAppModule, { logger: false });
app.useGlobalFilters(new CentralApiErrorFilter());
app.enableShutdownHooks();

// This service is the one a browser is allowed to address, because it fronts
// every other one. The allow-list is configuration rather than a constant, so a
// second portal is a second entry in `CENTRAL_API_CORS_ORIGINS` and not a deploy
// of this file. Nothing else in the workspace enables CORS: an internal service
// with no browser consumer does not need a cross-origin story, and one that has
// one by accident is a service whose operators did not choose to publish it.
app.enableCors({
  origin: env.corsOrigins,
  // A preflight is cached for five minutes by default, which is long enough that
  // revoking an origin takes five minutes to take effect and short enough that
  // the header is not re-fetched on every navigation.
  maxAge: 300,
});

await app.listen(env.port);
logger.info("service listening", {
  port: env.port,
  environment: env.environment,
  corsOrigins: env.corsOrigins,
});
