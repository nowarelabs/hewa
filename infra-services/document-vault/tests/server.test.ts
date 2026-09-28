import { describe, expect, test } from "vite-plus/test";
import { createServer } from "../src/server.js";

const options = { service: "@hewa/event-gateway", environment: "test", logLevel: "debug" };

describe("Document Vault HTTP surface", () => {
  test("reports the shared ok response code", async () => {
    const response = await createServer(options).request("/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "@hewa/event-gateway",
      code: "0",
      status: "ok",
    });
  });

  test("echoes an inbound request id", async () => {
    const response = await createServer(options).request("/health", {
      headers: { "x-request-id": "from-edge" },
    });
    expect(response.headers.get("x-request-id")).toBe("from-edge");
  });

  test("generates a request id when the caller sends none", async () => {
    const response = await createServer(options).request("/health");
    expect(response.headers.get("x-request-id")).toMatch(/^req_/);
  });

  test("falls back to info for an unknown log level", async () => {
    const app = createServer({ ...options, logLevel: "chatty" });
    expect((await app.request("/health")).status).toBe(200);
  });

  test("returns 404 for an unknown path", async () => {
    expect((await createServer(options).request("/nope")).status).toBe(404);
  });
});
