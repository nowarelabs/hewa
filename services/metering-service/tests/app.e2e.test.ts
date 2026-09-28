import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { MeteringServiceAppModule } from "../src/app.module.js";
import { MeteringServiceErrorFilter } from "../src/common/error.filter.js";

/**
 * Boots the real application, which is the only way to prove dependency
 * injection resolves and the global filter is wired up. A unit test of the
 * controller would pass even if the module graph were broken.
 */
describe("MeteringService application", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MeteringServiceAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MeteringServiceErrorFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("reports health on the shared response code", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "@hewa/metering-service",
      code: "0",
      status: "ok",
    });
  });
});
