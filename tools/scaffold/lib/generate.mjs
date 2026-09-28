/**
 * Walks a template directory, substitutes the placeholder tokens, and writes
 * the result. Existing files are never clobbered unless `--force` is passed, so
 * a generated shell can be edited by hand without losing work by accident.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(dir, entry.name), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Some template files are markers for empty directories, so a package keeps a
 * place in git even before it has any content.
 */
const KEEP_FILES = new Set([".gitkeep"]);

/**
 * @param {object} options
 * @param {string} options.templateDir
 * @param {string} options.targetDir
 * @param {Record<string, string>} options.tokens
 * @param {boolean} options.force
 * @param {(message: string) => void} options.log
 * @returns {Promise<{ written: string[]; skipped: string[] }>}
 */
export async function generate({ templateDir, targetDir, tokens, force, log }) {
  const files = await walk(templateDir);
  /** @type {string[]} */
  const written = [];
  /** @type {string[]} */
  const skipped = [];

  for (const file of files) {
    const target = path.join(targetDir, ...substituteName(file, tokens).split("/"));
    await mkdir(path.dirname(target), { recursive: true });

    if (KEEP_FILES.has(path.basename(file))) {
      const exists = await existsAsync(target);
      if (!exists) await writeFile(target, "");
      continue;
    }

    const exists = await existsAsync(target);
    if (exists && !force) {
      skipped.push(path.relative(targetDir, target));
      continue;
    }

    const contents = await readFile(path.join(templateDir, file), "utf8");
    await writeFile(target, substituteName(contents, tokens));
    written.push(path.relative(targetDir, target));
  }

  log(`  ${written.length} written${skipped.length ? `, ${skipped.length} kept` : ""}`);
  for (const file of skipped) log(`    kept existing ${file}`);
  return { written, skipped };
}

/**
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function existsAsync(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

import { substituteName } from "./tokens.mjs";
