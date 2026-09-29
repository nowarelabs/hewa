"use client";

import type { ReactElement } from "react";
import { Clock, FileText, Globe, Shield, TrendingUp, Users } from "lucide-react";

import type { PanelProps, ShellIcon } from "@hewa/app-shell";
import { CardList, Empty, KeyValues, Panel } from "./primitives";

type Category = "cia" | "military" | "economic" | "political" | "social";

interface Report {
  id: string;
  title: string;
  description: string;
  category: Category;
  source: string;
  publishedAt: string;
  /** A percentage, and a claim, not a measurement. Nothing downstream treats it as one. */
  confidence: number;
}

const REPORTS: Report[] = [
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

const CATEGORY_ICON: Record<Category, ShellIcon> = {
  cia: Shield,
  military: Globe,
  economic: TrendingUp,
  political: Users,
  social: FileText,
};

const CATEGORY_TINT: Record<Category, string> = {
  cia: "text-red-400 bg-red-500/15",
  military: "text-green-400 bg-green-500/15",
  economic: "text-yellow-400 bg-yellow-500/15",
  political: "text-blue-400 bg-blue-500/15",
  social: "text-purple-400 bg-purple-500/15",
};

/** A percentage, banded. Below 75 is shown as unreliable rather than merely low. */
function confidenceTint(confidence: number): string {
  if (confidence >= 90) return "text-green-400";
  if (confidence >= 75) return "text-yellow-400";
  return "text-red-400";
}

const RAIL: Record<string, { title: string; category: Category | null }> = {
  all: { title: "All reports", category: null },
  cia: { title: "Intelligence", category: "cia" },
  military: { title: "Military", category: "military" },
  political: { title: "Political", category: "political" },
  economic: { title: "Economic", category: "economic" },
};

export function ReportRailPanel({ item }: PanelProps): ReactElement {
  const entry = RAIL[item ?? "all"] ?? RAIL["all"];
  const category = entry?.category ?? null;
  const shown =
    category === null ? REPORTS : REPORTS.filter((report) => report.category === category);

  return (
    <Panel title={entry?.title ?? "Reports"}>
      {shown.length === 0 ? (
        <Empty>No reports in this category</Empty>
      ) : (
        <CardList
          items={shown.map((report) => ({
            id: report.id,
            title: report.title,
            detail: `${report.source} · ${String(report.confidence)}% confidence`,
          }))}
        />
      )}
    </Panel>
  );
}

export function ReportFeed(): ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <FileText className="h-5 w-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-ink">Open-source intelligence</h1>
        <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-400">
          {REPORTS.length} reports
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {REPORTS.map((report) => {
          const CategoryIcon = CATEGORY_ICON[report.category];
          return (
            <article
              key={report.id}
              className="rounded-lg border border-line bg-surface-raised p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CategoryIcon
                    className={`h-4 w-4 ${CATEGORY_TINT[report.category].split(" ")[0]}`}
                  />
                  <span className={`rounded px-2 py-0.5 text-xs ${CATEGORY_TINT[report.category]}`}>
                    {report.category.toUpperCase()}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs">
                  <span className="text-ink-muted">Confidence</span>
                  <span className={`font-medium ${confidenceTint(report.confidence)}`}>
                    {report.confidence}%
                  </span>
                </span>
              </div>

              <h2 className="mb-1 font-medium text-ink">{report.title}</h2>
              <p className="mb-2 text-sm text-ink-muted">{report.description}</p>

              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {report.source}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(report.publishedAt).toLocaleString()}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ReportDetailsPanel(): ReactElement {
  const first = REPORTS[0];
  return (
    <Panel title="Report details">
      {first === undefined ? (
        <Empty>Select a report</Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Title", value: first.title },
            { label: "Source", value: first.source },
            { label: "Category", value: first.category },
            { label: "Confidence", value: `${String(first.confidence)}%` },
          ]}
        />
      )}
    </Panel>
  );
}
