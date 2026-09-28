import { describe, expect, test } from "vite-plus/test";
import { GET } from "../src/app/health/route";

describe("GET /health", () => {
  test("reports the shared ok response code", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "@hewa/admin-dashboard",
      code: "0",
      status: "ok",
    });
  });
});
