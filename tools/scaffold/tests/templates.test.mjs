import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { INSTANCES, TEMPLATES_BY_KIND } from "./manifest.mjs";
import { substitute, substituteName, tokensFor } from "./lib/tokens.mjs";

const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

/** Matches anything that still looks like an unsubstituted placeholder. */
const TOKEN = /__[A-Z][A-Z0-9_]*__/;

/**
 * @param {string} dir
 * @returns {Promise<string[]>} paths relative to `dir`
 */
async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(path.join(dir, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

describe("every template", () => {
  for (const instance of INSTANCES) {
    const template = instance.template ?? TEMPLATES_BY_KIND[instance.kind];

    test(`resolves every placeholder for ${instance.name}`, async () => {
      const dir = path.join(templatesDir, template);
      const files = await walk(dir);
      expect(files.length).toBeGreaterThan(0);

      const tokens = tokensFor(instance);
      const unresolved = [];
      for (const file of files) {
        if (file.endsWith(".gitkeep")) continue;
        const raw = await readFile(path.join(dir, ...file.split("/")), "utf8");
        const contents = substitute(raw, tokens);
        const name = substituteName(file, tokens);
        // Names matter as well as bodies: a leftover token in a path would
        // still produce a file that lints, but not the file anyone intended.
        if (TOKEN.test(name) || TOKEN.test(contents)) unresolved.push(name);
      }

      // A token that survives substitution builds fine and fails only at
      // runtime, so this is the one place it can be caught cheaply.
      expect(unresolved).toEqual([]);
    });
  }
});
