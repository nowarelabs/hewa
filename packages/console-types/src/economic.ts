/**
 * The `economic` view: national indicators.
 *
 * This is the one view whose payload is not a list of rows. The figures, the
 * series behind the chart, the breakdown the pie draws, and the per-section
 * figures the rail column shows are four different shapes, and the panel needs
 * all four at once — so `Economy` is an object and the other six views are arrays.
 *
 * That is also why the rail's figures live here rather than in the panel. They
 * were in the panel, next to a second copy of the same numbers, and the two had
 * already drifted: the rail said GDP growth was 5.2% and the headline card said
 * 5.1%, in the same column of the same screen.
 */
export interface Indicator {
  readonly id: string;
  readonly label: string;
  /** Already formatted, units included. An endpoint sends a string, not a locale. */
  readonly value: string;
  readonly caption: string;
  /** Which way the figure is moving. Absent when it is not moving. */
  readonly trend?: "up" | "down";
}

/** One month of the GDP series the line chart draws. */
export interface GdpPoint {
  readonly month: string;
  readonly value: number;
}

/** One slice of the pie. The panel supplies the colours; they are not a fact. */
export interface Sector {
  readonly name: string;
  /** A percentage. Every sector's value adds to 100. */
  readonly value: number;
}

/** A label and a figure, for the rail column's key/value rows. */
export interface EconomicFigure {
  readonly label: string;
  readonly value: string;
}

/**
 * One section of the economy, which the rail column picks between.
 *
 * `id` is looked up from the rail selection, so the panel resolves a stale id to
 * its fallback rather than rendering nothing. `title` is the section's own name,
 * not the rail entry's, because the two are allowed to differ — a rail tab says
 * "Currency" because that is what fits in an icon rail, and the section may say
 * something longer.
 */
export interface EconomicSection {
  readonly id: string;
  readonly title: string;
  readonly figures: EconomicFigure[];
}

export interface Economy {
  readonly indicators: Indicator[];
  readonly gdpSeries: GdpPoint[];
  readonly sectors: Sector[];
  readonly sections: EconomicSection[];
}
