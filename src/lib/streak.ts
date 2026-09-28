type StreakProfile = { streak_days: number; last_active_date: string | null; timezone: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of `date` in the given IANA time zone (falls back to UTC). */
function localDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * The streak to show: the stored streak is only alive while the last active day is
 * today or yesterday in the user's time zone (mirrors get_leaderboard).
 */
export function getEffectiveStreak(profile: StreakProfile, now = new Date()): number {
  if (!profile.last_active_date) return 0;
  const yesterday = localDate(new Date(now.getTime() - DAY_MS), profile.timezone);
  return profile.last_active_date >= yesterday ? profile.streak_days : 0;
}
