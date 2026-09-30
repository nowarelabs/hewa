/**
 * The console's seed records, one module per view.
 *
 * Named after the view, and the name is the one that matters: the console asserts
 * that its `data/` directory is its views, and the service asserts that this
 * directory holds the same seven. A module called `feeds.ts` holding all of them
 * would break both of those assertions and neither would fail.
 */
export { ALERTS, ALERT_SEVERITIES } from "./alerts.js";
export { CARRIERS, FLIGHTS } from "./flights.js";
export { INCIDENTS, INCIDENT_KINDS } from "./conflicts.js";
export { ECONOMY, ECONOMY_SECTIONS, GDP_SERIES, INDICATORS, SECTOR_SHARE } from "./economic.js";
export { REPORTS, REPORT_CATEGORIES } from "./osint.js";
export { SATELLITES, SATELLITE_KINDS } from "./satellites.js";
export { STREAMS } from "./streams.js";
