// PRD-4: due review cards become "use this phrase" missions in chat and speaking.

export type PracticeCard = {
  id: string;
  target_text: string;
  ease_factor: number;
  interval_days: number;
  review_count: number;
};

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();

/** True when `text` contains `phrase` as whole words, ignoring case and punctuation. */
export function usesPhrase(text: string, phrase: string): boolean {
  const target = normalize(phrase);
  return target.length > 0 && ` ${normalize(text)} `.includes(` ${target} `);
}

/** Up to `max` due cards whose target text is short enough to use in a sentence (1-5 words). */
export function pickPracticeCards(cards: PracticeCard[], max = 3): PracticeCard[] {
  const seen = new Set<string>();
  return cards
    .filter((card) => {
      const phrase = normalize(card.target_text);
      const words = phrase.split(" ").length;
      if (!phrase || words > 5 || phrase.length > 40 || seen.has(phrase)) return false;
      seen.add(phrase);
      return true;
    })
    .slice(0, max);
}
