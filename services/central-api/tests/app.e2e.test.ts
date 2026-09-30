import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";

import { bootCentralApi } from "./boot.js";

/**
 * Boots the real application, which is the only way to prove dependency
 * injection resolves and the global filter is wired up. A unit test of the
 * controller would pass even if the module graph were broken.
 */
describe("CentralApi application", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("reports health on the shared response code", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "@hewa/central-api",
      code: "0",
      status: "ok",
    });
  });
});
