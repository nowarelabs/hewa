import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@hewa/observability";
import { SettlementServiceAppModule } from "./app.module.js";
import { SettlementServiceErrorFilter } from "./common/error.filter.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const logger = createLogger({ service: env.service });

const app = await NestFactory.create(SettlementServiceAppModule, { logger: false });
app.useGlobalFilters(new SettlementServiceErrorFilter());
app.enableShutdownHooks();

await app.listen(env.port);
logger.info("service listening", { port: env.port, environment: env.environment });
