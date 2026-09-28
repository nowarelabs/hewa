import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { mergeDependencies } from "./lib/dependencies.mjs";
import { generate } from "./lib/generate.mjs";

/** @type {string} */
let root;
/** @type {string} */
let templateDir;

const noop = () => {};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hewa-scaffold-"));
  templateDir = path.join(root, "template");
  await mkdir(templateDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/**
 * @param {string} name
 * @param {string} contents
 */
async function writeTemplateFile(name, contents) {
  const target = path.join(templateDir, ...name.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

describe("generate", () => {
  test("substitutes tokens in both file names and file contents", async () => {
    await writeTemplateFile("__NAME__/nested/placeholder.txt", "hello __TITLE__");

    const { written } = await generate({
      templateDir,
      targetDir: path.join(root, "out"),
      tokens: { __NAME__: "alpha", __TITLE__: "Alpha" },
      force: true,
      log: noop,
    });

    expect(written).toContain(path.join("alpha", "nested", "placeholder.txt"));
    await expect(
      readFile(path.join(root, "out", "alpha", "nested", "placeholder.txt"), "utf8"),
    ).resolves.toBe("hello Alpha");
  });

  test("keeps a hand-edited file unless force is passed", async () => {
    await writeTemplateFile("placeholder.txt", "from template");
    const targetDir = path.join(root, "out");
    const target = path.join(targetDir, "placeholder.txt");

    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });
    await writeFile(target, "hand edited");

    const { written, skipped } = await generate({
      templateDir,
      targetDir,
      tokens: {},
      force: false,
      log: noop,
    });

    expect(written).toHaveLength(0);
    expect(skipped).toEqual(["placeholder.txt"]);
    await expect(readFile(target, "utf8")).resolves.toBe("hand edited");
  });

  test("replaces that same file when force is passed", async () => {
    await writeTemplateFile("placeholder.txt", "from template");
    const targetDir = path.join(root, "out");

    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });
    await writeFile(path.join(targetDir, "placeholder.txt"), "hand edited");
    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });

    await expect(readFile(path.join(targetDir, "placeholder.txt"), "utf8")).resolves.toBe(
      "from template",
    );
  });

  test("preserves a .gitkeep rather than truncating it", async () => {
    await writeTemplateFile(".gitkeep", "");
    const targetDir = path.join(root, "out");
    const target = path.join(targetDir, ".gitkeep");

    await generate({ templateDir, targetDir, tokens: {}, force: false, log: noop });
    await writeFile(target, "");
    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });

    await expect(readFile(target, "utf8")).resolves.toBe("");
  });
});

describe("mergeDependencies", () => {
  test("adds declared dependencies, keeping the object sorted", async () => {
    const targetDir = path.join(root, "out");
    await writeTemplateFile("package.json", '{"name":"x","dependencies":{"hono":"catalog:"}}\n');
    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });

    const added = await mergeDependencies(targetDir, {
      kafkajs: "catalog:",
      "@hewa/proto": "workspace:*",
    });

    expect(added).toHaveLength(2);
    const manifest = JSON.parse(await readFile(path.join(targetDir, "package.json"), "utf8"));
    // Sorted so regenerating never produces a noisy diff.
    expect(Object.keys(manifest.dependencies)).toEqual(["@hewa/proto", "hono", "kafkajs"]);
    expect(manifest.dependencies.hono).toBe("catalog:");
  });

  test("is a no-op when the instance declares nothing", async () => {
    await expect(mergeDependencies(path.join(root, "out"), {})).resolves.toEqual([]);
  });

  test("refuses to silently rewrite a version already declared", async () => {
    const targetDir = path.join(root, "out");
    await writeTemplateFile("package.json", '{"name":"x","dependencies":{"hono":"^3"}}\n');
    await generate({ templateDir, targetDir, tokens: {}, force: true, log: noop });

    await expect(mergeDependencies(targetDir, { hono: "catalog:" })).rejects.toThrow(/conflicts/);
  });
});
