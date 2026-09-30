/**
 * The `alerts` view: things that need attention now.

Records for the panels beside them. When the
alerts endpoint lands this module becomes the only thing that changes: the
panels already take their rows from one named import, and nothing else in the
app knows what a row is made of.
 */

export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "security" | "conflict" | "economic" | "weather" | "health" | "traffic";

export interface Alert {
  id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  lat: number;
  lng: number;
  county: string;
  raisedAt: string;
}

export const ALERTS: Alert[] = [
  {
    id: "1",
    title: "Security alert: suspected militant activity",
    description:
      "Intelligence reports indicate potential militant activity in the Mandera County border region.",
    category: "security",
    severity: "critical",
    lat: 4.2312,
    lng: 40.867,
    county: "Mandera",
    raisedAt: "2026-03-26T09:15:00Z",
  },
  {
    id: "2",
    title: "Weather warning: heavy rainfall",
    description:
      "The meteorological department forecasts heavy rains in western Kenya over the next 48 hours.",
    category: "weather",
    severity: "high",
    lat: 0.5634,
    lng: 34.7518,
    county: "Kakamega",
    raisedAt: "2026-03-26T08:00:00Z",
  },
  {
    id: "3",
    title: "Health alert: disease outbreak",
    description:
      "Confirmed cases of cholera reported in Homa Bay County. Health officials on high alert.",
    category: "health",
    severity: "high",
    lat: -0.5273,
    lng: 34.4571,
    county: "Homa Bay",
    raisedAt: "2026-03-26T07:30:00Z",
  },
  {
    id: "4",
    title: "Traffic advisory: road closure",
    description:
      "The Mombasa–Nairobi highway is partially closed following an accident. Expect delays.",
    category: "traffic",
    severity: "medium",
    lat: -1.1569,
    lng: 37.0742,
    county: "Machakos",
    raisedAt: "2026-03-26T06:45:00Z",
  },
  {
    id: "5",
    title: "Economic alert: currency fluctuation",
    description: "KES is volatile against major currencies. Markets are reacting to global events.",
    category: "economic",
    severity: "medium",
    lat: -1.2921,
    lng: 36.8219,
    county: "Nairobi",
    raisedAt: "2026-03-26T06:00:00Z",
  },
  {
    id: "6",
    title: "Security alert: armed robbery",
    description: "Multiple reports of armed robbery along the Nairobi–Nakuru corridor.",
    category: "security",
    severity: "medium",
    lat: -0.4581,
    lng: 36.0527,
    county: "Nakuru",
    raisedAt: "2026-03-25T23:00:00Z",
  },
  {
    id: "7",
    title: "Weather advisory: high winds",
    description:
      "Strong winds expected in the Turkana region. Residents advised to secure property.",
    category: "weather",
    severity: "low",
    lat: 3.3256,
    lng: 35.5821,
    county: "Turkana",
    raisedAt: "2026-03-25T18:00:00Z",
  },
  {
    id: "8",
    title: "Conflict warning: tensions rising",
    description: "Increased tensions reported between communities in Marsabit. Monitor closely.",
    category: "conflict",
    severity: "high",
    lat: 2.6845,
    lng: 37.9895,
    county: "Marsabit",
    raisedAt: "2026-03-25T16:30:00Z",
  },
];

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
