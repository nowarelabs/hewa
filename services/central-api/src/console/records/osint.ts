import type { Report, ReportCategory } from "@hewa/console-types";

/**
 * Seed reports for the console's `osint` view.
 */

/**
 * Every category the feed can hold, which is one more than the rail lists.
 *
 * The rail has no `social` entry and two of the reports below are social, so a bar
 * built from the rail alone would report fewer reports than the feed holds.
 */
export const REPORT_CATEGORIES: ReportCategory[] = [
  "cia",
  "military",
  "economic",
  "political",
  "social",
];

export const REPORTS: Report[] = [
  {
    id: "1",
    title: "Regional military deployment update",
    description:
      "Increased military presence observed in northern Kenya. Intelligence suggests routine rotation and infrastructure strengthening.",
    category: "military",
    source: "Satellite imagery analysis",
    publishedAt: "2026-03-26T08:00:00Z",
    confidence: 85,
  },
  {
    id: "2",
    title: "Trade corridor activity",
    description:
      "Mombasa port throughput up 15% month over month. Infrastructure investment continues to drive growth.",
    category: "economic",
    source: "Trade data analysis",
    publishedAt: "2026-03-26T07:30:00Z",
    confidence: 92,
  },
  {
    id: "3",
    title: "Political coalition formation",
    description:
      "Opposition parties are showing signs of coalition building ahead of the 2027 elections.",
    category: "political",
    source: "Human intelligence",
    publishedAt: "2026-03-26T06:00:00Z",
    confidence: 78,
  },
  {
    id: "4",
    title: "Social media sentiment analysis",
    description:
      "Public sentiment is trending negative on economic conditions. Inflation concerns dominate.",
    category: "social",
    source: "Social media monitoring",
    publishedAt: "2026-03-25T22:00:00Z",
    confidence: 88,
  },
  {
    id: "5",
    title: "Cross-border movement patterns",
    description:
      "Increased movement from Somalia into the Dadaab region. Border monitoring stations report higher traffic.",
    category: "cia",
    source: "Border surveillance",
    publishedAt: "2026-03-25T18:00:00Z",
    confidence: 90,
  },
  {
    id: "6",
    title: "Infrastructure development",
    description:
      "Highway construction between Nairobi and Nakuru is ahead of schedule, with a significant economic effect.",
    category: "economic",
    source: "Satellite imagery analysis",
    publishedAt: "2026-03-25T14:00:00Z",
    confidence: 95,
  },
  {
    id: "7",
    title: "Tribal alliance networks",
    description:
      "Political alliance patterns show strong regional affiliations that will affect coalition arithmetic.",
    category: "political",
    source: "Network analysis",
    publishedAt: "2026-03-25T10:00:00Z",
    confidence: 72,
  },
  {
    id: "8",
    title: "Youth unemployment sentiment",
    description:
      "Young people are expressing frustration on social platforms. A potential unrest vector.",
    category: "social",
    source: "Social media monitoring",
    publishedAt: "2026-03-25T08:00:00Z",
    confidence: 82,
  },
];
