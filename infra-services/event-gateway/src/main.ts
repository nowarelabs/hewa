import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { createServer, createServerLogger } from "./server.js";

const config = loadConfig();
const logger = createServerLogger(config);
const app = createServer(config);

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info("process listening", { port: info.port, environment: config.environment });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info("shutting down", { signal });
    server.close(() => process.exit(0));
  });
}
