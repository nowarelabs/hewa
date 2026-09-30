import { describe, expect, test } from "vite-plus/test";
import {
  ALERTS,
  ALERT_SEVERITIES,
  CARRIERS,
  ECONOMY,
  FLIGHTS,
  INCIDENTS,
  INCIDENT_KINDS,
  REPORTS,
  REPORT_CATEGORIES,
  SATELLITES,
  SATELLITE_KINDS,
  STREAMS,
} from "../src/console/records/index.js";

/**
 * The invariants the seed records have to hold.
 *
 * These moved here with the records, deliberately. They are properties of the
 * data and the client gets no say in them, so they are asserted once, by whoever
 * owns the data, rather than by a test in the app that has to import the records
 * in order to check them.
 */

const ICAO24 = /^[0-9a-f]{6}$/;

/**
 * Every row is on a group the view names.
 *
 * This is the check that catches a row the summary bar would not count. It is one
 * way round on purpose: a vocabulary entry with no rows is legitimate — `election`
 * and `scientific` are both real and both empty — and it is the row that is
 * missing from the vocabulary that goes uncounted. The other direction is the
 * console's business and is asserted where the bar is built.
 */
function everyRowIsGrouped(rows: string[], vocabulary: string[], name: string) {
  expect(vocabulary.length, `${name} has no group vocabulary`).toBeGreaterThan(0);

  for (const row of rows) {
    expect(vocabulary, `${name}: ${row} is on a group the view does not name`).toContain(row);
  }
}

describe("alerts", () => {
  test("ids are unique", () => {
    expect(new Set(ALERTS.map((alert) => alert.id)).size).toBe(ALERTS.length);
  });

  test("every row is on a severity the view names", () => {
    everyRowIsGrouped(
      ALERTS.map((alert) => alert.severity),
      ALERT_SEVERITIES,
      "alerts",
    );
  });

  test("every severity the view names is a real one", () => {
    expect([...ALERT_SEVERITIES].toSorted()).toEqual(["critical", "high", "low", "medium"]);
  });

  test("every alert has a county and coordinates inside Kenya", () => {
    for (const alert of ALERTS) {
      expect(alert.county, alert.id).not.toBe("");
      expect(alert.lat, alert.id).toBeGreaterThanOrEqual(-4.7);
      expect(alert.lat, alert.id).toBeLessThanOrEqual(5.0);
      expect(alert.lng, alert.id).toBeGreaterThanOrEqual(33.9);
      expect(alert.lng, alert.id).toBeLessThanOrEqual(41.9);
    }
  });

  test("raisedAt is a parsable ISO timestamp", () => {
    for (const alert of ALERTS) {
      expect(alert.raisedAt, alert.id).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      expect(Number.isNaN(Date.parse(alert.raisedAt)), alert.id).toBe(false);
    }
  });
});

describe("conflicts", () => {
  test("ids are unique", () => {
    expect(new Set(INCIDENTS.map((incident) => incident.id)).size).toBe(INCIDENTS.length);
  });

  test("every row is on a kind the view names", () => {
    everyRowIsGrouped(
      INCIDENTS.map((incident) => incident.kind),
      INCIDENT_KINDS,
      "conflicts",
    );
  });

  test("every kind the view names is a real one", () => {
    expect([...INCIDENT_KINDS].toSorted()).toEqual([
      "armed",
      "election",
      "protest",
      "resource",
      "tribal",
    ]);
  });

  test("every incident names both a county and a sub-county", () => {
    for (const incident of INCIDENTS) {
      expect(incident.county, incident.id).not.toBe("");
      expect(incident.subCounty, incident.id).not.toBe("");
    }
  });

  test("casualties are a non-negative whole number", () => {
    for (const incident of INCIDENTS) {
      expect(Number.isInteger(incident.casualties), incident.id).toBe(true);
      expect(incident.casualties, incident.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("flights", () => {
  test("icao24 is a unique lowercase hex id", () => {
    expect(new Set(FLIGHTS.map((flight) => flight.icao24)).size).toBe(FLIGHTS.length);

    for (const flight of FLIGHTS) {
      expect(flight.icao24, flight.callsign).toMatch(ICAO24);
    }
  });

  test("every row is on a carrier the view names", () => {
    everyRowIsGrouped(
      FLIGHTS.map((flight) => flight.carrier),
      CARRIERS,
      "flights",
    );
  });

  test("a flight is not both arriving and departing", () => {
    for (const flight of FLIGHTS) {
      expect(flight.isArriving && flight.isDeparting, flight.callsign).toBe(false);
    }
  });

  test("altitude, velocity and heading are in range", () => {
    for (const flight of FLIGHTS) {
      expect(flight.altitude, flight.callsign).toBeGreaterThan(0);
      expect(flight.velocity, flight.callsign).toBeGreaterThan(0);
      expect(flight.heading, flight.callsign).toBeGreaterThanOrEqual(0);
      expect(flight.heading, flight.callsign).toBeLessThan(360);
    }
  });

  test("coordinates are inside Kenya", () => {
    for (const flight of FLIGHTS) {
      expect(flight.lat, flight.callsign).toBeGreaterThanOrEqual(-4.7);
      expect(flight.lat, flight.callsign).toBeLessThanOrEqual(5.0);
      expect(flight.lng, flight.callsign).toBeGreaterThanOrEqual(33.9);
      expect(flight.lng, flight.callsign).toBeLessThanOrEqual(41.9);
    }
  });
});

describe("osint", () => {
  test("ids are unique", () => {
    expect(new Set(REPORTS.map((report) => report.id)).size).toBe(REPORTS.length);
  });

  test("every row is on a category the view names", () => {
    everyRowIsGrouped(
      REPORTS.map((report) => report.category),
      REPORT_CATEGORIES,
      "osint",
    );
  });

  test("every category the view names is a real one", () => {
    expect([...REPORT_CATEGORIES].toSorted()).toEqual([
      "cia",
      "economic",
      "military",
      "political",
      "social",
    ]);
  });

  test("confidence is a whole percentage", () => {
    for (const report of REPORTS) {
      expect(Number.isInteger(report.confidence), report.id).toBe(true);
      expect(report.confidence, report.id).toBeGreaterThanOrEqual(0);
      expect(report.confidence, report.id).toBeLessThanOrEqual(100);
    }
  });
});

describe("satellites", () => {
  test("ids are unique", () => {
    expect(new Set(SATELLITES.map((satellite) => satellite.id)).size).toBe(SATELLITES.length);
  });

  test("every row is on a kind the view names", () => {
    everyRowIsGrouped(
      SATELLITES.map((satellite) => satellite.kind),
      SATELLITE_KINDS,
      "satellites",
    );
  });

  test("every kind the view names is a real one", () => {
    expect([...SATELLITE_KINDS].toSorted()).toEqual([
      "communication",
      "navigation",
      "reconnaissance",
      "scientific",
      "weather",
    ]);
  });

  test("altitude and velocity are positive", () => {
    for (const satellite of SATELLITES) {
      expect(satellite.altitudeKm, satellite.id).toBeGreaterThan(0);
      expect(satellite.velocityKms, satellite.id).toBeGreaterThan(0);
    }
  });
});

describe("streams", () => {
  test("ids are unique", () => {
    expect(new Set(STREAMS.map((stream) => stream.id)).size).toBe(STREAMS.length);
  });

  test("channels are unique", () => {
    expect(new Set(STREAMS.map((stream) => stream.channel)).size).toBe(STREAMS.length);
  });

  test("every stream has a YouTube video id", () => {
    for (const stream of STREAMS) {
      expect(stream.videoId, stream.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(stream.channel, stream.id).not.toBe("");
    }
  });
});

describe("economic", () => {
  test("indicators have unique ids", () => {
    const ids = ECONOMY.indicators.map((indicator) => indicator.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every indicator is labelled and valued", () => {
    for (const indicator of ECONOMY.indicators) {
      expect(indicator.label, indicator.id).not.toBe("");
      expect(indicator.value, indicator.id).not.toBe("");
    }
  });

  test("the series is in calendar order and every point is positive", () => {
    const months = ECONOMY.gdpSeries.map((point) => point.month);
    expect(new Set(months).size).toBe(months.length);

    for (const point of ECONOMY.gdpSeries) {
      expect(point.value, point.month).toBeGreaterThan(0);
    }
  });

  test("the rail's latest quarter is the end of the series", () => {
    const latest = ECONOMY.gdpSeries.at(-1);
    const headline = ECONOMY.sections
      .find((section) => section.id === "gdp")
      ?.figures.find((figure) => figure.label === "Latest quarter");

    expect(latest).toBeDefined();
    expect(headline).toBeDefined();
    expect(headline?.value).toBe(`${latest?.value} B USD`);
  });

  test("sector shares are percentages that add up to the whole pie", () => {
    const total = ECONOMY.sectors.reduce((sum, sector) => sum + sector.value, 0);

    expect(total).toBe(100);
  });

  test("section ids are unique", () => {
    const ids = ECONOMY.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every figure the sections show is populated", () => {
    for (const section of ECONOMY.sections) {
      expect(section.title, section.id).not.toBe("");
      expect(section.figures.length, section.id).toBeGreaterThan(0);

      for (const figure of section.figures) {
        expect(figure.label, section.id).not.toBe("");
        expect(figure.value, section.id).not.toBe("");
      }
    }
  });

  test("the rail and the headline cards report the same figures", () => {
    const cards = new Map(
      ECONOMY.indicators.map((indicator) => [indicator.label, indicator.value]),
    );

    const disagreements = ECONOMY.sections.flatMap((section) =>
      section.figures
        .filter((figure) => cards.has(figure.label) && cards.get(figure.label) !== figure.value)
        .map(
          (figure) =>
            `${section.id}/${figure.label} says ${figure.value}, the card says ${String(cards.get(figure.label))}`,
        ),
    );

    expect(disagreements).toEqual([]);
  });
});
