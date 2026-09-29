// Spaced repetition (SM-2) and the "sync" coverage metric, shared by every review screen.
import { countedWords } from "@/lib/textProcessor";

export type SrsState = { ease_factor: number; interval_days: number; review_count: number };

/**
 * A card is mastered once recalled three times in a row: intervals go 1, 6, then at least 8 days
 * at any ease, so a new card can get there in about a week. A lapse resets the interval, so a
 * forgotten card stops counting until it is relearned. One definition for every screen.
 */
export const MASTERED_INTERVAL_DAYS = 7;

export const isMastered = (card: { interval_days: number }) => card.interval_days >= MASTERED_INTERVAL_DAYS;

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
 * Share of the user's `topN` most frequent native words (summed over all imports) that a mastered
 * card uses. Card texts are split into words the same way imports are counted, so a word must
 * appear as a whole word: "나" is not in "나무". A Korean word of two or more syllables also
 * counts when a card word starts with it, as endings follow the stem ("먹었어" in "먹었어요").
 */
export function syncCoverage(
  importFrequencies: Frequency[][],
  cards: { native_text: string; interval_days: number }[],
  locale: string,
  topN = 100,
) {
  const totals = new Map<string, number>();
  for (const frequencies of importFrequencies) {
    for (const { word, count } of frequencies) {
      const key = word.toLowerCase();
      totals.set(key, (totals.get(key) ?? 0) + count);
    }
  }
  const topWords = [...totals].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([word]) => word);
  const known = new Set(cards.filter(isMastered).flatMap((c) => countedWords(c.native_text, locale)));
  const knownList = [...known];
  const isCovered = (word: string) =>
    known.has(word) || (/^[가-힣]{2,}$/.test(word) && knownList.some((cardWord) => cardWord.startsWith(word)));

  const covered = topWords.filter(isCovered).length;
  return {
    total: topWords.length,
    covered,
    percent: topWords.length > 0 ? Math.round((covered / topWords.length) * 100) : 0,
  };
}
