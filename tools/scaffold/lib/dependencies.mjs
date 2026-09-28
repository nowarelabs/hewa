/**
 * Merges the dependencies an instance declares in the manifest into its
 * generated package.json.
 *
 * The template stays generic, so a Kafka consumer is not forced on a document
 * store. Declaring the libraries per instance keeps one template per kind while
 * still letting a shell ship the runtime it actually needs.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} targetDir
 * @param {Record<string, string>} extra
 * @returns {Promise<string[]>} the dependency names that were added
 */
export async function mergeDependencies(targetDir, extra) {
  const names = Object.keys(extra);
  if (names.length === 0) return [];

  const manifestPath = path.join(targetDir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  /** @type {Record<string, string>} */
  const dependencies = { ...manifest.dependencies };
  for (const name of names) {
    if (dependencies[name] === extra[name]) continue;
    if (dependencies[name] !== undefined) {
      throw new Error(
        `${manifest.name} already depends on ${name}@${dependencies[name]}, ` +
          `which conflicts with the manifest's ${extra[name]}`,
      );
    }
    dependencies[name] = extra[name];
  }

  // Sorted so a regenerated package.json never produces a noisy diff.
  manifest.dependencies = Object.fromEntries(
    Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
  );

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return names;
}
