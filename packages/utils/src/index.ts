const typeOf = (value: unknown): string => (Array.isArray(value) ? "array" : typeof value);

export function greeting(): string {
  return "Hello from @hewa/utils!";
}

export const is = {
  a: (value: unknown): boolean => Array.isArray(value),
  b: (value: unknown): boolean => typeOf(value) === "boolean",
  n: (value: unknown): boolean => typeOf(value) === "number",
  o: (value: unknown): boolean => typeOf(value) === "object",
  p: (value: unknown): boolean => value instanceof Promise,
  s: (value: unknown): boolean => typeOf(value) === "string",
  nil: (value: unknown): boolean => value === null || value === undefined,
};

export function roundTo(value: number, decimalPlaces = 0): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
