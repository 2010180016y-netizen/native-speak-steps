import { describe, it, expect } from "vitest";
import { getEffectiveStreak } from "./streak";

// 2026-09-29 10:00 in Asia/Seoul (UTC+9).
const now = new Date("2026-09-29T01:00:00Z");
const profile = (last_active_date: string | null, streak_days = 5) => ({ streak_days, last_active_date, timezone: "Asia/Seoul" });

describe("getEffectiveStreak", () => {
  it("keeps the streak when last active today or yesterday", () => {
    expect(getEffectiveStreak(profile("2026-09-29"), now)).toBe(5);
    expect(getEffectiveStreak(profile("2026-09-28"), now)).toBe(5);
  });

  it("drops a streak that was broken by a missed day", () => {
    expect(getEffectiveStreak(profile("2026-09-27"), now)).toBe(0);
  });

  it("is zero for users who were never active", () => {
    expect(getEffectiveStreak(profile(null), now)).toBe(0);
  });

  it("uses the user's time zone, not UTC", () => {
    // 2026-09-29 00:30 in Seoul is still 2026-09-28 in UTC.
    const justAfterMidnight = new Date("2026-09-28T15:30:00Z");
    expect(getEffectiveStreak(profile("2026-09-28"), justAfterMidnight)).toBe(5);
    expect(getEffectiveStreak(profile("2026-09-27"), justAfterMidnight)).toBe(0);
  });
});
