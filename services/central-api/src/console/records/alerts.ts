import type { Alert, AlertSeverity } from "@hewa/console-types";

/**
 * Seed alerts for the console's `alerts` view.
 *
 * Hardcoded on purpose. These stand in for an alert feed that is not built, and a
 * fixture that lives in the app is a fixture the app can quietly come to depend
 * on — the panels would filter it, the tests would count it, and moving it behind
 * an endpoint would become a rewrite rather than a delete. Here it is data the
 * service owns, and the app has to fetch it like anything else.
 */

/** Every severity the feed can hold, whether or not a row currently does. */
export const ALERT_SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "low"];

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
