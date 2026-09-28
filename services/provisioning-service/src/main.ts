import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@hewa/observability";
import { ProvisioningServiceAppModule } from "./app.module.js";
import { ProvisioningServiceErrorFilter } from "./common/error.filter.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const logger = createLogger({ service: env.service });

const app = await NestFactory.create(ProvisioningServiceAppModule, { logger: false });
app.useGlobalFilters(new ProvisioningServiceErrorFilter());
app.enableShutdownHooks();

await app.listen(env.port);
logger.info("service listening", { port: env.port, environment: env.environment });
