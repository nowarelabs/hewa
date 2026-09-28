import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@hewa/observability";
import { InvoicingServiceAppModule } from "./app.module.js";
import { InvoicingServiceErrorFilter } from "./common/error.filter.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const logger = createLogger({ service: env.service });

const app = await NestFactory.create(InvoicingServiceAppModule, { logger: false });
app.useGlobalFilters(new InvoicingServiceErrorFilter());
app.enableShutdownHooks();

await app.listen(env.port);
logger.info("service listening", { port: env.port, environment: env.environment });
