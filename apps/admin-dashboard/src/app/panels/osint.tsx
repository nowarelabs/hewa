"use client";

import type { ReactElement } from "react";
import { Clock, FileText, Globe, Shield, TrendingUp, Users } from "lucide-react";

import type { PanelProps, ShellIcon } from "@hewa/app-shell";
import {
  CardList,
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { REPORTS, REPORT_CATEGORIES, type Category } from "../data/osint";
import { useFilterParam } from "../state/filter";

/**
 * The `osint` view: every panel the OSINT tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

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

/**
 * The main column: every report, filtered by category.
 *
 * The category a report belongs to is the first thing the bar tells you and the
 * one thing you act on, so the chip that says it is the chip that sets it.
 */
export function ReportFeed(): ReactElement {
  const categories = useFilterParam("osint");
  const shown = visibleBy(REPORTS, (report) => report.category, categories.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <FileText className="h-5 w-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-ink">Open-source intelligence</h1>
        <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-400">
          {REPORTS.length} reports
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(REPORTS, (report) => report.category, {
          keys: REPORT_CATEGORIES,
          label: (category) => category.toUpperCase(),
          tint: (category) => CATEGORY_TINT[category],
        })}
        filter={{
          label: "Filter by category",
          selected: categories.selected,
          onToggle: categories.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? <Empty>No reports match these categories</Empty> : null}
        {shown.map((report) => {
          const CategoryIcon = CATEGORY_ICON[report.category];
          return (
            <article
              data-row={report.id}
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
