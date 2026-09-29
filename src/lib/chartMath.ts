// Geometry for the charts in src/components/Charts.tsx, kept apart so it can be tested.

/** The smallest 1, 2 or 5 × 10^n that is at least `value`: a tidy top for an axis. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / power;
  return (mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10) * power;
}

/** Where each slice of a ring of circumference `circumference` starts and how long it is. Zero-sum input gives none. */
export function donutArcs(values: number[], circumference: number): { offset: number; length: number }[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => ({ offset: 0, length: 0 }));
  let offset = 0;
  return values.map((value) => {
    const length = (value / total) * circumference;
    const arc = { offset, length };
    offset += length;
    return arc;
  });
}

/**
 * A line through `values` and the area under it, in a 100 × 100 box (y grows downwards, `top` is
 * the value at the upper edge). Points sit in the middle of equal-width slots, so an axis label
 * per slot lines up under its point. `xs` are the points' x positions in percent.
 */
export function areaPaths(values: number[], top: number) {
  const xs = values.map((_, i) => ((i + 0.5) * 100) / values.length);
  const ys = values.map((value) => 100 - (Math.min(value, top) / top) * 100);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x} ${ys[i]}`).join(" ");
  const area = values.length ? `${line} L${xs[xs.length - 1]} 100 L${xs[0]} 100 Z` : "";
  return { xs, ys, line, area };
}
