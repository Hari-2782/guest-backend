/** Converts a value (number/string/null) into a plain JS number for API responses. */
export function toNumber(value: number | string | { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/** Rounds a currency amount to 2 decimal places, avoiding floating point drift. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
