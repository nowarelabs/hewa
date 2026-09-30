import { readdirSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { config } from "../src/app/shell.config";
import { RAIL } from "../src/app/panels/flights";
import { ALERTS, SEVERITIES } from "../src/app/data/alerts";
import { INCIDENTS, INCIDENT_KINDS } from "../src/app/data/conflicts";
import { INDICATORS, SECTORS } from "../src/app/data/economic";
import { CARRIERS, FLIGHTS, airlineFor } from "../src/app/data/flights";
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

  // The rail's carriers are the summary bar's chips, and the panel filters on
  // the chip's name. A rail entry the callsign table does not name is a tab
  // that opens an empty column, because nothing matches the filter.
  test("every carrier rail entry has flights and a chip", () => {
    for (const entry of config.views["flights"]?.rail ?? []) {
      if (entry.id === "all") {
        continue;
      }
      const found = FLIGHTS.filter((flight) => airlineFor(flight.callsign) === entry.label);
      expect(found.length, `rail entry ${entry.id} has no flights`).toBeGreaterThan(0);
      expect(CARRIERS, `rail entry ${entry.id} has no chip`).toContain(entry.label);
    }
  });

  // The panel's rail is what the shell config builds from, so the two can only
  // disagree by the config importing a different list than the panel filters on.
  test("the shell's rail is the panel's rail", () => {
    expect((config.views["flights"]?.rail ?? []).map((entry) => entry.id)).toEqual(
      RAIL.map((entry) => entry.id),
    );
  });

  // The table renders these with `Math.round` and a `°`, so a heading of 400 is
  // not a wrong number in a data file: it is `NaN°` on screen.
  test("every flight carries values the table can render", () => {
    for (const flight of FLIGHTS) {
      const where = `${flight.callsign} (${flight.icao24})`;
      expect(flight.icao24, `${where} is not an ICAO 24-bit address`).toMatch(/^[0-9a-f]{6}$/);
      expect(flight.callsign.trim(), `${where} has no callsign`).not.toBe("");
      expect(flight.originCountry.trim(), `${where} has no country`).not.toBe("");
      expect(Math.abs(flight.latitude), `${where} latitude`).toBeLessThanOrEqual(90);
      expect(Math.abs(flight.longitude), `${where} longitude`).toBeLessThanOrEqual(180);
      expect(flight.altitude, `${where} altitude`).toBeGreaterThan(0);
      expect(flight.velocity, `${where} velocity`).toBeGreaterThan(0);
      expect(flight.heading, `${where} heading`).toBeGreaterThanOrEqual(0);
      expect(flight.heading, `${where} heading`).toBeLessThan(360);
    }
  });

  test("flight addresses are unique, or the table renders duplicate keys", () => {
    const addresses = FLIGHTS.map((flight) => flight.icao24);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  test("a flight is not both arriving and departing", () => {
    for (const flight of FLIGHTS) {
      expect(
        flight.isArriving && flight.isDeparting,
        `${flight.callsign} is arriving and departing`,
      ).toBe(false);
    }
  });
});
