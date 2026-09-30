import type { Incident, IncidentKind } from "@hewa/console-types";

/**
 * Seed incidents for the console's `conflicts` view.
 */

/**
 * Every kind the stream can hold, which is one more than the rail lists.
 *
 * `election` is here and no incident below is one, so the bar shows its chip at
 * zero rather than pretending the kind does not exist — and any that arrives is
 * counted, because the bar counts the rows and adds whatever it finds to this
 * list rather than filtering them by it.
 */
export const INCIDENT_KINDS: IncidentKind[] = [
  "armed",
  "protest",
  "election",
  "resource",
  "tribal",
];

export const INCIDENTS: Incident[] = [
  {
    id: "1",
    title: "Pastoralist conflict in Marsabit",
    description:
      "Inter-communal violence between pastoralist groups over grazing rights and water resources.",
    county: "Marsabit",
    subCounty: "North Horr",
    kind: "tribal",
    severity: "high",
    casualties: 12,
    verified: true,
    reportedAt: "2026-03-26T08:30:00Z",
  },
  {
    id: "2",
    title: "Election-related protests in Kisumu",
    description: "Demonstrations following disputed election results with reports of clashes.",
    county: "Kisumu",
    subCounty: "Kisumu Central",
    kind: "protest",
    severity: "medium",
    casualties: 5,
    verified: true,
    reportedAt: "2026-03-26T07:15:00Z",
  },
  {
    id: "3",
    title: "Land dispute in Nakuru",
    description: "Violent confrontation over land ownership in the Rift Valley region.",
    county: "Nakuru",
    subCounty: "Naivasha",
    kind: "resource",
    severity: "high",
    casualties: 8,
    verified: false,
    reportedAt: "2026-03-26T06:00:00Z",
  },
  {
    id: "4",
    title: "Armed robbery in Nairobi",
    description: "Organised criminal activity targeting businesses and individuals.",
    county: "Nairobi",
    subCounty: "Dagoretti",
    kind: "armed",
    severity: "medium",
    casualties: 2,
    verified: true,
    reportedAt: "2026-03-25T22:45:00Z",
  },
  {
    id: "5",
    title: "Protests in Mombasa",
    description: "Peaceful demonstrations demanding better services and infrastructure.",
    county: "Mombasa",
    subCounty: "Mombasa Central",
    kind: "protest",
    severity: "low",
    casualties: 0,
    verified: true,
    reportedAt: "2026-03-25T18:30:00Z",
  },
];
