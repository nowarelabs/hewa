import { describe, expect, test } from "vite-plus/test";
import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  test("reports the shared ok response code", () => {
    expect(new HealthController().check()).toEqual({
      service: "@hewa/settlement-service",
      code: "0",
      status: "ok",
    });
  });
});
