#!/usr/bin/env node
/**
 * Generate the app, service, and infrastructure shells from `templates/`.
 *
 *   vp exec node index.mjs              # every instance in the manifest
 *   vp exec node index.mjs central-api  # just one
 *   vp exec node index.mjs --force      # overwrite files that already exist
 *   vp exec node index.mjs --list       # print what would be generated
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import { INSTANCES, ROOTS, TEMPLATES_BY_KIND } from "./manifest.mjs";
import { mergeDependencies } from "./lib/dependencies.mjs";
import { generate } from "./lib/generate.mjs";
import { tokensFor } from "./lib/tokens.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, "..", "..");
const templatesDir = path.join(here, "templates");

/** @param {string} message */
function log(message) {
  process.stdout.write(`${message}\n`);
}

async function templateExists(name) {
  try {
    await access(path.join(templatesDir, name));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const list = argv.includes("--list");
  const names = argv.filter((arg) => !arg.startsWith("--"));

  if (names.length > 0) {
    const known = new Set(INSTANCES.map((instance) => instance.name));
    const unknown = names.filter((name) => !known.has(name));
    if (unknown.length > 0) {
      log(`Unknown instance(s): ${unknown.join(", ")}`);
      log(`Known: ${[...known].join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  const selected = names.length
    ? INSTANCES.filter((instance) => names.includes(instance.name))
    : INSTANCES;

  // Group by template so each one is walked once.
  /** @type {Map<string, typeof INSTANCES>} */
  const byTemplate = new Map();
  for (const instance of selected) {
    const template = instance.template ?? TEMPLATES_BY_KIND[instance.kind];
    byTemplate.set(template, [...(byTemplate.get(template) ?? []), instance]);
  }

  /** @type {string[]} */
  const missing = [];
  for (const template of byTemplate.keys()) {
    if (!(await templateExists(template))) missing.push(template);
  }
  if (missing.length > 0) {
    log(`Missing template(s): ${missing.map((t) => `templates/${t}`).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (list) {
    for (const [template, instances] of byTemplate) {
      log(`${template}:`);
      for (const instance of instances) {
        const root = ROOTS[instance.kind];
        log(`  ${root}/${instance.name}`);
      }
    }
    return;
  }

  for (const [template, instances] of byTemplate) {
    log(`${template} -> ${instances.length} instance(s)`);
    for (const instance of instances) {
      const targetDir = path.join(workspaceRoot, ROOTS[instance.kind], instance.name);
      log(`  ${ROOTS[instance.kind]}/${instance.name} (${instance.title})`);
      await generate({
        templateDir: path.join(templatesDir, template),
        targetDir,
        tokens: tokensFor(instance),
        force,
        log,
      });

      // Applied after generation, and only when asked for, so that regenerating
      // a shell cannot quietly add a library to a package someone hand-edited.
      if (instance.dependencies) {
        const added = await mergeDependencies(targetDir, instance.dependencies);
        if (added.length > 0) log(`    declared ${added.join(", ")}`);
      }
    }
  }

  log("");
  log("Next: pnpm install, then pnpm run build:shared before testing dependents.");
}

await main();
