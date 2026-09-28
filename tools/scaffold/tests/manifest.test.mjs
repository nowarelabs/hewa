import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { INSTANCES, ROOTS, TEMPLATES_BY_KIND } from "./manifest.mjs";
import { tokensFor } from "./lib/tokens.mjs";

const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

describe("the instance manifest", () => {
  test("covers every kind", () => {
    const kinds = new Set(INSTANCES.map((instance) => instance.kind));
    expect([...kinds].sort((a, b) => a.localeCompare(b))).toEqual(["app", "infra", "service"]);
  });

  test("has no duplicate names", () => {
    const names = INSTANCES.map((instance) => instance.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("has no duplicate ports", () => {
    const ports = INSTANCES.map((instance) => instance.port);
    expect(new Set(ports).size).toBe(ports.length);
  });

  test("points every instance at a template that exists", async () => {
    for (const instance of INSTANCES) {
      const template = instance.template ?? TEMPLATES_BY_KIND[instance.kind];
      await expect(access(path.join(templatesDir, template))).resolves.toBeUndefined();
    }
  });

  test("keeps every name usable as a package and a directory", () => {
    for (const instance of INSTANCES) {
      expect(instance.name).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
      expect(instance.port).toBeGreaterThan(0);
      expect(instance.port).toBeLessThanOrEqual(65535);
      // A token left unsubstituted would generate a package that cannot build.
      expect(tokensFor(instance).__PACKAGE__).toBe(`@hewa/${instance.name}`);
    }
  });

  test("declares only catalog and workspace ranges", () => {
    for (const instance of INSTANCES) {
      for (const [name, range] of Object.entries(instance.dependencies ?? {})) {
        if (range.startsWith("catalog:") || range.startsWith("workspace:")) continue;
        throw new Error(`${instance.name} pins ${name} to ${range}`);
      }
    }
  });

  test("routes each kind to its own workspace root", () => {
    for (const instance of INSTANCES) {
      expect(Object.values(ROOTS)).toContain(ROOTS[instance.kind]);
    }
  });
});

describe("the infra dependencies", () => {
  test("give each infrastructure process the library its description promises", () => {
    const byName = new Map(INSTANCES.map((instance) => [instance.name, instance]));

    expect(byName.get("event-gateway")?.dependencies).toMatchObject({
      kafkajs: "catalog:",
      "@hewa/proto": "workspace:*",
    });
    expect(byName.get("document-vault")?.dependencies).toMatchObject({
      "@aws-sdk/client-s3": "catalog:",
    });
    expect(byName.get("system-queue")?.dependencies).toMatchObject({
      bullmq: "catalog:",
      ioredis: "catalog:",
    });
  });
});
