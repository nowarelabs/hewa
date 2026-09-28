import { describe, expect, test } from "vite-plus/test";
import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  test("reports the shared ok response code", () => {
    expect(new HealthController().check()).toEqual({
      service: "@hewa/invoicing-service",
      code: "0",
      status: "ok",
    });
  });
});
