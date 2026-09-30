import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { BUTTON, CHIP, CHIP_ACTIVE, ICON_BUTTON, SURFACE } from "../src/app/ui/tokens";

/**
 * The panel's own controls do not invent their own colours.
 *
 * A `bg-neutral-800` is not a style preference here. The shell toggles a single
 * `.dark` class and every colour follows from the variables in its stylesheet,
 * so a literal grey follows nothing: it is the same in both themes, and it is the
 * one class in a control that no one reviews, because it looks like every other
 * class in the file.
 *
 * Nothing catches it on its own. The type checker cannot, lint does not know
 * which of Tailwind's several hundred colour utilities the shell has tokens
 * for, and a screenshot in one theme shows a plausible grey. So this asserts it.
 */

const UI_DIRECTORY = fileURLToPath(new URL("../src/app/ui", import.meta.url));
const DATA_DIRECTORY = fileURLToPath(new URL("../src/app/data", import.meta.url));

/**
 * A colour utility is `bg-`, `text-`, `fill-` and the rest, followed by a
 * colour. Collected once because the rules below need the same list twice and
 * two copies of "what counts as a colour" is how one of them ends up
 * disagreeing with the other.
 */
const UTILITY =
  /(?:bg|text|border|ring|outline|from|via|to|divide|placeholder|fill|stroke|shadow)-[\w-]+/g;

/** Tailwind's greys, and the near-synonyms that read as greys. */
const GREY =
  /\b(?:bg|text|border|ring|outline|from|via|to|divide|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone)-\d+\b/;

/** A hex literal, which is a grey until proven otherwise. */
const HEX = /#[0-9a-fA-F]{3,8}\b/;

/** `dark:`, which hard-codes the theme switch the shell owns. */
const DARK_VARIANT = /\bdark:/;

const sources = (): { name: string; text: string }[] =>
  readdirSync(UI_DIRECTORY)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({ name, text: readFileSync(`${UI_DIRECTORY}/${name}`, "utf8") }));

const dataSources = (): { name: string; text: string }[] =>
  readdirSync(DATA_DIRECTORY)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ name, text: readFileSync(`${DATA_DIRECTORY}/${name}`, "utf8") }));

/**
 * The colour names in a string, with the widths and sizes taken out.
 *
 * `text-sm` is a font size and `border-b` is a width. An earlier version of the
 * token rule filtered by "does not start with a digit", which passed
 * `border-b` and failed `text-sm`, and would have passed `bg-accent-faint` for
 * all the trouble it was written to catch.
 */
const NOT_A_COLOUR = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
  "b",
  "t",
  "l",
  "r",
  "x",
  "y",
  "s",
  "e",
  "w",
  "start",
  "end",
  "center",
  "left",
  "right",
  "justify",
  "none",
  "transparent",
  "current",
  "inherit",
]);

function colourUtilities(text: string): string[] {
  return [...new Set(text.match(UTILITY) ?? [])]
    .map((utility) => utility.slice(utility.indexOf("-") + 1))
    .filter((value) => !/^\d/.test(value) && !NOT_A_COLOUR.has(value));
}

describe("the shell's tokens", () => {
  test("a source file to check was found", () => {
    // Without this, a moved or renamed directory makes every rule below pass
    // vacuously, which is the failure mode a test written from a file listing
    // always has.
    expect(sources().length).toBeGreaterThan(0);
    expect(dataSources().length).toBeGreaterThan(0);
  });

  for (const { name, text } of sources()) {
    test(`ui/${name} contains no greys`, () => {
      expect(text.match(GREY)).toBeNull();
    });

    test(`ui/${name} contains no hex literals`, () => {
      expect(text.match(HEX)).toBeNull();
    });

    test(`ui/${name} does not hard-code the theme switch`, () => {
      expect(text.match(DARK_VARIANT)).toBeNull();
    });
  }

  const SHELL_COLOURS = [
    "canvas",
    "surface",
    "surface-raised",
    "surface-sunken",
    "line",
    "line-strong",
    "ink",
    "ink-muted",
    "ink-faint",
    "accent",
    "accent-hover",
    "accent-ink",
    "elevation",
  ];

  for (const [name, token] of Object.entries({
    BUTTON,
    ICON_BUTTON,
    CHIP,
    CHIP_ACTIVE,
    SURFACE,
  })) {
    test(`${name} is built from colours the shell defines`, () => {
      const colours = colourUtilities(token);
      expect(colours.length).toBeGreaterThan(0);
      for (const colour of colours) {
        expect(SHELL_COLOURS).toContain(colour);
      }
    });
  }

  /**
   * A record carries no styling.
   *
   * This is the rule that a `tint` field breaks, and the one that is easiest to
   * break by accident, because a record with a colour on it looks tidy and
   * works perfectly well. It is wrong for this app in particular: the colour is
   * how the shell says something, it changes when the theme does, and it is not
   * a property of an alert, an incident or a report. The day the records come
   * off an endpoint it is a field no endpoint will ever fill.
   *
   * The rules above are not enough here. They look for greys, for hex and for
   * `dark:`, and none of those are what a record reaches for — `text-green-400`
   * and `bg-surface` are both legal shell colours, and both are wrong on a
   * record. So this asks the other question: is there any colour utility at all.
   */
  for (const { name, text } of dataSources()) {
    test(`data/${name} carries no styling`, () => {
      expect(colourUtilities(text)).toEqual([]);
      expect(text.match(HEX)).toBeNull();
      expect(text.match(DARK_VARIANT)).toBeNull();
    });
  }

  test("an active chip is the same chip, in the accent", () => {
    // A pressed filter with a different shape from an unpressed one makes a row
    // of toggles look like a row of two kinds of control. The border is meant to
    // change — that is what says "on" — so this compares the shape, not the
    // colour.
    const radius = (token: string): string[] =>
      token.split(" ").filter((part) => part.startsWith("rounded"));
    expect(radius(CHIP_ACTIVE)).toEqual(radius(CHIP));
    expect(CHIP_ACTIVE).toContain("text-accent");
    expect(CHIP).not.toContain("text-accent");
  });
});
