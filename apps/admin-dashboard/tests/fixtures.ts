import { ResponseCode } from "@hewa/response-codes";
import type { ConsoleEnvelope, ConsoleViewKey } from "@hewa/console-types";

/**
 * Console payloads for the app's tests, written here and not borrowed.
 *
 * These are deliberately not the service's records. A test that imports the
 * records it is asserting about is asserting that the records are the same as
 * themselves, and if it did, then adding a flight to the service would move
 * every count in this suite — so a data change would look like a UI change and
 * the person reading the failure would be sent to the wrong file.
 *
 * Two rows per view is enough to make a filter do something. They are short and
 * ugly on purpose: nothing here is read by eye, only counted and filtered.
 *
 * Two of them carry a group with no rows — an `election` incident and a
 * `scientific` satellite — because "a group the bar offers that nothing is on"
 * is a state the chips have to survive, and a fixture in which every group is
 * populated never puts it on screen.
 */
export const consoleFixtures = {
  alerts: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "a1",
        title: "Heavy rainfall expected",
        description: "Western Kenya.",
        category: "weather",
        severity: "high",
        lat: 0.5634,
        lng: 34.7518,
        county: "Kakamega",
        raisedAt: "2026-03-26T08:00:00Z",
      },
      {
        id: "a2",
        title: "Armed robbery reported",
        description: "Nakuru corridor.",
        category: "security",
        severity: "medium",
        lat: -0.4581,
        lng: 36.0527,
        county: "Nakuru",
        raisedAt: "2026-03-25T23:00:00Z",
      },
    ],
    meta: { groups: ["critical", "high", "medium", "low"] },
  },

  conflicts: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "c1",
        title: "Pastoralist violence",
        description: "Grazing and water.",
        county: "Marsabit",
        subCounty: "North Horr",
        kind: "tribal",
        severity: "high",
        casualties: 12,
        verified: true,
        reportedAt: "2026-03-26T08:30:00Z",
      },
      {
        id: "c2",
        title: "Roadblock robbery",
        description: "Organised crime.",
        county: "Nairobi",
        subCounty: "Dagoretti",
        kind: "armed",
        severity: "medium",
        casualties: 2,
        verified: false,
        reportedAt: "2026-03-25T22:45:00Z",
      },
    ],
    // Five kinds, two of them with nothing on. The rail offers four of these;
    // `election` is the one it does not, and it is still counted.
    meta: { groups: ["armed", "protest", "election", "resource", "tribal"] },
  },

  economic: {
    code: ResponseCode.Ok,
    data: {
      indicators: [
        { id: "fx", label: "KES/USD", value: "153.25", caption: "+0.15%", trend: "up" },
        { id: "gdp", label: "GDP growth", value: "5.1%", caption: "Q4 2025" },
      ],
      gdpSeries: [
        { month: "Nov", value: 11.5 },
        { month: "Dec", value: 11.8 },
      ],
      sectors: [
        { name: "Agriculture", value: 60 },
        { name: "Services", value: 40 },
      ],
      sections: [
        {
          id: "overview",
          title: "Overview",
          figures: [{ label: "GDP growth", value: "5.1%" }],
        },
        {
          id: "markets",
          title: "Markets",
          figures: [{ label: "NSE 20", value: "1,842.15" }],
        },
      ],
    },
    meta: { groups: [] },
  },

  flights: {
    code: ResponseCode.Ok,
    data: [
      {
        icao24: "4ca1d2",
        callsign: "KQ100",
        originCountry: "Kenya",
        lat: 2.184,
        lng: 35.442,
        altitude: 11582,
        velocity: 248,
        heading: 312,
        isArriving: false,
        isDeparting: false,
        carrier: "Kenya Airways",
      },
      {
        icao24: "068d1a",
        callsign: "JM8200",
        originCountry: "Kenya",
        lat: 0.884,
        lng: 34.612,
        altitude: 10668,
        velocity: 232,
        heading: 268,
        isArriving: false,
        isDeparting: false,
        carrier: "Jambojet",
      },
      {
        icao24: "064b90",
        callsign: "XK621",
        originCountry: "Kenya",
        lat: -3.204,
        lng: 38.884,
        altitude: 10058,
        velocity: 240,
        heading: 161,
        isArriving: false,
        isDeparting: false,
        carrier: "Safarilink",
      },
      {
        icao24: "064c3a",
        callsign: "XK450",
        originCountry: "Kenya",
        lat: -3.921,
        lng: 39.564,
        altitude: 1829,
        velocity: 175,
        heading: 21,
        isArriving: true,
        isDeparting: false,
        carrier: "Safarilink",
      },
      {
        icao24: "89640d",
        callsign: "QTR1369",
        originCountry: "Qatar",
        lat: 3.612,
        lng: 40.884,
        altitude: 11097,
        velocity: 252,
        heading: 341,
        isArriving: false,
        isDeparting: false,
        carrier: "Unknown",
      },
    ],
    // Both halves of a disagreement between the rail and the vocabulary, at
    // once, because the chips no longer come from the rail: "Unknown" is a
    // group with no tab, and "Fly540" is a tab with no group and no rows. The
    // panel has to survive either — a tab the service does not offer opens the
    // whole catalogue, and a group with no tab still gets a chip at zero.
    meta: { groups: ["Kenya Airways", "Jambojet", "Safarilink", "Unknown"] },
  },

  osint: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "r1",
        title: "Military rotation",
        description: "Northern Kenya.",
        category: "military",
        source: "Satellite imagery",
        publishedAt: "2026-03-26T08:00:00Z",
        confidence: 85,
      },
      {
        id: "r2",
        title: "Sentiment trending negative",
        description: "On economic conditions.",
        category: "social",
        source: "Social monitoring",
        publishedAt: "2026-03-25T22:00:00Z",
        confidence: 88,
      },
    ],
    // `social` was in the data and not in the bar. It is in both now.
    meta: { groups: ["cia", "military", "economic", "political", "social"] },
  },

  satellites: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "s1",
        name: "Landsat 8",
        kind: "reconnaissance",
        lat: 1.2345,
        lng: 36.789,
        altitudeKm: 705,
        velocityKms: 7.5,
      },
      {
        id: "s2",
        name: "GPS IIF-1",
        kind: "navigation",
        lat: -1.8901,
        lng: 36.234,
        altitudeKm: 20200,
        velocityKms: 3.9,
      },
    ],
    // `scientific` has a chip and no rail entry, because an air console has no
    // panel to open for it.
    meta: { groups: ["reconnaissance", "weather", "communication", "navigation", "scientific"] },
  },

  streams: {
    code: ResponseCode.Ok,
    data: [
      { id: "t1", title: "Citizen TV Kenya", channel: "citizen" },
      { id: "t2", title: "KTN News Live", channel: "ktn" },
    ],
    // The channels are the service's vocabulary now, and `spice` is in it with
    // no row: the bar and the rail are both built from these names, so a channel
    // with no stream still has a chip and a tab that are honest about it.
    meta: { groups: ["citizen", "ktn", "aljazeera", "skynews", "ntv", "k24", "spice", "capital"] },
  },
} satisfies { [K in ConsoleViewKey]: ConsoleEnvelope<unknown, string> };
