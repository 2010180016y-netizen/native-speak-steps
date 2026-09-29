// Spaced repetition (SM-2) and the "sync" coverage metric, shared by every review screen.

export type SrsState = { ease_factor: number; interval_days: number; review_count: number };

/** Anki's convention: a card is mature once its review interval reaches 21 days. */
export const MATURE_INTERVAL_DAYS = 21;

/** Next SM-2 state for a card rated `quality` (0-5; below 3 means forgotten). */
export function scheduleReview(card: SrsState, quality: number, now = new Date()) {
  const q = 5 - quality;
  const ease_factor = Math.max(1.3, card.ease_factor + (0.1 - q * (0.08 + q * 0.02)));
  const interval_days =
    quality < 3 || card.review_count === 0 ? 1
    : card.review_count === 1 ? 6
    : Math.round(card.interval_days * ease_factor);

  const next = new Date(now);
  next.setDate(next.getDate() + interval_days);
  return {
    ease_factor,
    interval_days,
    review_count: card.review_count + 1,
    difficulty: quality,
    next_review_at: next.toISOString(),
  };
}

type Frequency = { word: string; count: number };

/**
 * Share of the user's `topN` most frequent native words (summed over all imports)
 * that appear in the native text of at least one mature card.
 */
export function syncCoverage(
  importFrequencies: Frequency[][],
  cards: { native_text: string; interval_days: number }[],
  topN = 100,
) {
  const totals = new Map<string, number>();
  for (const frequencies of importFrequencies) {
    for (const { word, count } of frequencies) totals.set(word, (totals.get(word) ?? 0) + count);
  }
  const topWords = [...totals].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([word]) => word.toLowerCase());
  const matureTexts = cards
    .filter((c) => c.interval_days >= MATURE_INTERVAL_DAYS)
    .map((c) => c.native_text.toLowerCase());

  const covered = topWords.filter((word) => matureTexts.some((text) => text.includes(word))).length;
  return {
    total: topWords.length,
    covered,
    percent: topWords.length > 0 ? Math.round((covered / topWords.length) * 100) : 0,
  };
}
