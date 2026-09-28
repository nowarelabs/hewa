import { describe, expect, test } from "vite-plus/test";
import { greeting, is, roundTo, slugify } from "../src/index.ts";

test("greeting", () => {
  expect(greeting()).toBe("Hello from @hewa/utils!");
});

describe("is", () => {
  test("is.a", () => {
    expect(is.a([])).toBe(true);
    expect(is.a({})).toBe(false);
  });

  test("is.n", () => {
    expect(is.n(1)).toBe(true);
    expect(is.n(NaN)).toBe(true);
    expect(is.n("1")).toBe(false);
  });

  test("is.p", async () => {
    expect(is.p(Promise.resolve())).toBe(true);
    await expect(Promise.resolve()).resolves.toBeUndefined();
    expect(is.p({ status: "pending" })).toBe(false);
  });

  test("is.nil", () => {
    expect(is.nil(null)).toBe(true);
    expect(is.nil(undefined)).toBe(true);
    expect(is.nil(0)).toBe(false);
    expect(is.nil("")).toBe(false);
  });
});

describe("roundTo", () => {
  test("defaults to whole numbers", () => {
    expect(roundTo(1.123)).toBe(1);
    expect(roundTo(1.823)).toBe(2);
  });

  test("rounds to a decimal place", () => {
    expect(roundTo(1.123, 1)).toBe(1.1);
    expect(roundTo(1.183, 1)).toBe(1.2);
  });

  test("rounds to two decimal places", () => {
    expect(roundTo(1.123, 2)).toBe(1.12);
    expect(roundTo(1.128, 2)).toBe(1.13);
  });

  test("rounds negative values", () => {
    expect(roundTo(-1.123, 0)).toBe(-1);
    expect(roundTo(-1.123, 1)).toBe(-1.1);
    expect(roundTo(-1.123, 2)).toBe(-1.12);
  });

  test("keeps precision for large numbers", () => {
    expect(roundTo(12345678.912345678, 2)).toBe(12345678.91);
  });
});

describe("slugify", () => {
  test("lowercases and joins words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("strips diacritics", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  test("trims leading and trailing separators", () => {
    expect(slugify("  --He wa--  ")).toBe("he-wa");
  });
});
