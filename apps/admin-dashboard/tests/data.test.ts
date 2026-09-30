import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { config } from "../src/app/shell.config";
import { ALERTS, SEVERITIES } from "../src/app/data/alerts";
import { INCIDENTS, INCIDENT_KINDS } from "../src/app/data/conflicts";
import { INDICATORS, SECTORS } from "../src/app/data/economic";
import { AIRLINE_CODES, airlineFor } from "../src/app/data/flights";
import { REPORTS, REPORT_CATEGORIES } from "../src/app/data/osint";
import { KINDS, SATELLITES } from "../src/app/data/satellites";
import { STREAMS } from "../src/app/data/streams";

/** `data/` is one module per view, named after it, like `panels/`. */
const modules = readdirSync(new URL("../src/app/data/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name.replace(/\.tsx?$/, ""))
  .sort();

const keys = Object.keys(config.views).sort();

function uniqueIds(rows: readonly { id: string }[], what: string): void {
  const ids = rows.map((row) => row.id);
  expect(new Set(ids).size, `${what} has a duplicate id: ${ids.join(", ")}`).toBe(ids.length);
}

describe("data", () => {
  test("every view has exactly one module, named after its key", () => {
    expect(modules).toEqual(keys);
  });

  // The bar builds a chip per group and looks the tint up by the key, so a
  // record whose group is missing from the list is a row no chip accounts for.
  test("every record's group is one the summary bar can name", () => {
    for (const alert of ALERTS) {
      expect(SEVERITIES, `alert ${alert.id} has severity ${alert.severity}`).toContain(
        alert.severity,
      );
    }
    for (const incident of INCIDENTS) {
      expect(INCIDENT_KINDS, `incident ${incident.id} has kind ${incident.kind}`).toContain(
        incident.kind,
      );
    }
    for (const report of REPORTS) {
      expect(REPORT_CATEGORIES, `report ${report.id} has category ${report.category}`).toContain(
        report.category,
      );
    }
    for (const satellite of SATELLITES) {
      expect(KINDS, `satellite ${satellite.id} has kind ${satellite.kind}`).toContain(
        satellite.kind,
      );
    }
  });

  test("ids are unique", () => {
    uniqueIds(ALERTS, "alerts");
    uniqueIds(INCIDENTS, "conflicts");
    uniqueIds(REPORTS, "osint");
    uniqueIds(SATELLITES, "satellites");
    uniqueIds(STREAMS, "streams");
    uniqueIds(INDICATORS, "economic");
  });

  test("the sectors a pie draws add up", () => {
    const total = SECTORS.reduce((sum, sector) => sum + sector.value, 0);
    expect(total).toBe(100);
  });

  test("every carrier panel resolves to a named carrier", () => {
    // A code whose prefix the table has never heard of produces a panel that
    // asks for one airline and draws every row as "Unknown".
    for (const code of Object.values(AIRLINE_CODES)) {
      expect(code, "a carrier panel has no code").toBeDefined();
      expect(airlineFor(code as string), `code ${code} resolves to Unknown`).not.toBe("Unknown");
    }
  });

  // The panel reads `AIRLINE_CODES[item] ?? undefined`, and `undefined` means
  // the whole airspace. A rail entry with no code is not an error: the Fly540
  // tab opens and lists every flight in the country.
  test("every carrier rail entry resolves to a callsign the table knows", () => {
    for (const entry of config.views["flights"]?.rail ?? []) {
      const code = AIRLINE_CODES[entry.id];
      if (entry.id === "all") {
        continue;
      }
      if (code === undefined) {
        throw new Error(`rail entry ${entry.id} has no callsign code`);
      }
      expect(airlineFor(code), `rail entry ${entry.id} resolves to Unknown`).not.toBe("Unknown");
    }
  });
});
