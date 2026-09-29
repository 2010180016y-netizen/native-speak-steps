import { describe, it, expect } from "vitest";
import { scheduleReview, syncCoverage, MATURE_INTERVAL_DAYS } from "./srs";

const now = new Date("2026-09-29T00:00:00Z");
const card = (review_count: number, interval_days = 1, ease_factor = 2.5) => ({ review_count, interval_days, ease_factor });

describe("scheduleReview", () => {
  it("follows the SM-2 interval steps for correct answers", () => {
    expect(scheduleReview(card(0), 4, now).interval_days).toBe(1);
    expect(scheduleReview(card(1), 4, now).interval_days).toBe(6);
    expect(scheduleReview(card(2, 6), 4, now).interval_days).toBe(15); // 6 * 2.5
  });

  it("resets the interval and lowers ease when forgotten", () => {
    const next = scheduleReview(card(5, 30, 2.5), 1, now);
    expect(next.interval_days).toBe(1);
    expect(next.ease_factor).toBeCloseTo(1.96);
    expect(next.review_count).toBe(6);
  });

  it("never lets ease drop below 1.3", () => {
    expect(scheduleReview(card(3, 10, 1.3), 0, now).ease_factor).toBe(1.3);
  });

  it("sets the due date from the interval", () => {
    expect(scheduleReview(card(1), 5, now).next_review_at).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("syncCoverage", () => {
  const imports = [
    [{ word: "커피", count: 10 }, { word: "회의", count: 6 }],
    [{ word: "커피", count: 3 }, { word: "주말", count: 4 }],
  ];

  it("counts a frequent word as covered only by a mature card containing it", () => {
    const cards = [
      { native_text: "커피 한 잔 주세요", interval_days: MATURE_INTERVAL_DAYS },
      { native_text: "회의 시작해요", interval_days: 6 },
    ];
    expect(syncCoverage(imports, cards)).toEqual({ total: 3, covered: 1, percent: 33 });
  });

  it("limits to the top N words across imports", () => {
    expect(syncCoverage(imports, [], 2).total).toBe(2);
  });

  it("is zero without imports", () => {
    expect(syncCoverage([], [{ native_text: "x", interval_days: 99 }])).toEqual({ total: 0, covered: 0, percent: 0 });
  });
});
