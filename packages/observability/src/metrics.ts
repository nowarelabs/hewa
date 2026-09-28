/**
 * A tiny in-process metrics registry, shaped so a Prometheus or OTLP exporter
 * can be attached later without changing call sites.
 */

export type MetricType = "counter" | "gauge" | "histogram";

export interface CounterSample {
  type: "counter";
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface GaugeSample {
  type: "gauge";
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface HistogramSample {
  type: "histogram";
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  /** Observation counts keyed by upper bound; `+Inf` is always present. */
  buckets: Record<string, number>;
}

export type MetricSample = CounterSample | GaugeSample | HistogramSample;

export const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

function seriesKey(name: string, labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0
    ? name
    : `${name}{${entries.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
}

function emptyBuckets(buckets: readonly number[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const bound of buckets) result[formatBound(bound)] = 0;
  result["+Inf"] = 0;
  return result;
}

function formatBound(bound: number): string {
  return Number.isInteger(bound) ? String(bound) : String(bound);
}

export class MetricsRegistry {
  readonly #counters = new Map<string, CounterSample>();
  readonly #gauges = new Map<string, GaugeSample>();
  readonly #histograms = new Map<string, HistogramSample>();
  readonly #buckets: readonly number[];

  constructor(options: { buckets?: readonly number[] } = {}) {
    this.#buckets = [...(options.buckets ?? DEFAULT_BUCKETS)].sort((a, b) => a - b);
  }

  increment(name: string, labels: Record<string, string> = {}, delta = 1): void {
    const existing = this.#counters.get(seriesKey(name, labels));
    this.#counters.set(seriesKey(name, labels), {
      type: "counter",
      name,
      labels,
      value: (existing?.value ?? 0) + delta,
    });
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.#gauges.set(seriesKey(name, labels), { type: "gauge", name, labels, value });
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const id = seriesKey(name, labels);
    const sample =
      this.#histograms.get(id) ??
      ({
        type: "histogram",
        name,
        labels,
        count: 0,
        sum: 0,
        buckets: emptyBuckets(this.#buckets),
      } satisfies HistogramSample);

    sample.count += 1;
    sample.sum += value;

    for (const bound of this.#buckets) {
      if (value <= bound) sample.buckets[formatBound(bound)] += 1;
    }
    sample.buckets["+Inf"] += 1;

    this.#histograms.set(id, sample);
  }

  /** A single scrape payload, ready to hand to an exporter. */
  collect(): MetricSample[] {
    return [...this.#counters.values(), ...this.#gauges.values(), ...this.#histograms.values()];
  }

  reset(): void {
    this.#counters.clear();
    this.#gauges.clear();
    this.#histograms.clear();
  }
}
