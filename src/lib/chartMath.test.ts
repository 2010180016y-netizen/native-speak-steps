import { describe, it, expect } from "vitest";
import { areaPaths, donutArcs, niceMax } from "./chartMath";

describe("niceMax", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect([1, 2, 3, 5, 6, 137, 200, 201, 999].map(niceMax)).toEqual([1, 2, 5, 5, 10, 200, 200, 500, 1000]);
  });

  it("gives a usable axis for nothing to plot", () => {
    expect([0, -3, NaN].map(niceMax)).toEqual([1, 1, 1]);
  });
});

describe("donutArcs", () => {
  it("splits the ring in proportion to the values, one slice after the other", () => {
    expect(donutArcs([1, 3], 100)).toEqual([{ offset: 0, length: 25 }, { offset: 25, length: 75 }]);
  });

  it("draws a single slice as the whole ring", () => {
    expect(donutArcs([7], 100)).toEqual([{ offset: 0, length: 100 }]);
  });

  it("draws nothing when every value is zero", () => {
    expect(donutArcs([0, 0], 100)).toEqual([{ offset: 0, length: 0 }, { offset: 0, length: 0 }]);
  });
});

describe("areaPaths", () => {
  it("places points in slot centres and scales the values to the top", () => {
    const { xs, ys, line, area } = areaPaths([0, 5, 10], 10);
    expect(xs.map((x) => Math.round(x * 100) / 100)).toEqual([16.67, 50, 83.33]);
    expect(ys).toEqual([100, 50, 0]);
    expect(line.startsWith("M16.666666666666668 100 L50 50")).toBe(true);
    expect(area.endsWith("L83.33333333333333 100 L16.666666666666668 100 Z")).toBe(true);
  });

  it("keeps a value above the top inside the box", () => {
    expect(areaPaths([50], 10).ys).toEqual([0]);
  });

  it("has no path without values", () => {
    expect(areaPaths([], 1)).toEqual({ xs: [], ys: [], line: "", area: "" });
  });
});
