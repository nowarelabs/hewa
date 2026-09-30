import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { CONSOLE_VIEWS, consolePath, type ConsolePayload } from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";
import { CentralApiAppModule } from "../src/app.module.js";
import { CentralApiErrorFilter } from "../src/common/error.filter.js";

/**
 * Walks every view over real HTTP.
 *
 * `CONSOLE_VIEWS` is the whole list of views the console can ask for, and this
 * asks for each one. A view added to the contract with no route fails here rather
 * than as a 404 in a browser, and a route added for a view nobody has heard of
 * fails the envelope's own test on the other side of this boundary.
 */
describe("GET /console/:view", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CentralApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new CentralApiErrorFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("every view answers with its envelope and no rows", async () => {
    for (const view of CONSOLE_VIEWS) {
      const response = await fetch(`${baseUrl}${consolePath(view)}`);
      const body: unknown = await response.json();

      expect(response.status, `${view} answered ${response.status}`).toBe(200);
      expect(body, `${view} envelope`).toEqual({
        code: ResponseCode.Ok,
        data: expect.anything(),
        meta: { groups: expect.any(Array) },
      });
    }
  });

  test("every view sends something, and a list view sends a list", async () => {
    for (const view of CONSOLE_VIEWS) {
      const payload = (await (
        await fetch(`${baseUrl}${consolePath(view)}`)
      ).json()) as ConsolePayload[typeof view];

      if (payload.data instanceof Array) {
        expect(payload.data.length, `${view} has no seed records`).toBeGreaterThan(0);
      }
    }
  });

  test("the two ungrouped views carry an empty group vocabulary", async () => {
    const economic = (await (
      await fetch(`${baseUrl}/console/economic`)
    ).json()) as ConsolePayload["economic"];
    const streams = (await (
      await fetch(`${baseUrl}/console/streams`)
    ).json()) as ConsolePayload["streams"];

    expect(economic.meta.groups).toEqual([]);
    expect(streams.meta.groups).toEqual([]);
  });

  test("the five grouped views carry a vocabulary that is not empty", async () => {
    const grouped = ["alerts", "conflicts", "flights", "osint", "satellites"] as const;

    for (const view of grouped) {
      const payload = (await (
        await fetch(`${baseUrl}${consolePath(view)}`)
      ).json()) as ConsolePayload[typeof view];

      expect(payload.meta.groups.length, `${view} has no groups`).toBeGreaterThan(0);
    }
  });

  test("an unknown view is not found", async () => {
    await expect(fetch(`${baseUrl}/console/not-a-view`)).resolves.toMatchObject({
      status: 404,
    });
  });
});
