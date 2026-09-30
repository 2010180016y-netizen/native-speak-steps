import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { scheduleReview } from "@/lib/srs";
import { track } from "@/lib/analytics";
import { pickPracticeCards, type PracticeCard } from "@/lib/phrasePractice";

async function fetchDueCards(userId: string | undefined): Promise<PracticeCard[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from("srs_cards")
    .select("id, target_text, ease_factor, interval_days, review_count")
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at")
    .limit(30);
  return pickPracticeCards(data ?? []);
}

/** Due cards to practise in conversation; using a phrase counts as a successful review. */
export const usePhrasePractice = () => {
  const { user } = useAuth();
  const recordActivity = useRecordActivity();
  const [practiceCards, setPracticeCards] = useState<PracticeCard[]>([]);
  const pending = useRef<Promise<PracticeCard[]>>(Promise.resolve([]));

  /** Picks the cards for a new conversation, or restores `saved` ones of a resumed conversation. */
  const loadPracticeCards = useCallback(
    (saved?: PracticeCard[]) => {
      const load = saved ? Promise.resolve(saved) : fetchDueCards(user?.id);
      pending.current = load;
      setPracticeCards(saved ?? []);
      // A newer conversation may have started while this one was loading.
      void load.then((cards) => {
        if (pending.current === load) setPracticeCards(cards);
      });
    },
    [user],
  );

  /** The current conversation's cards once loaded. AI requests wait for it, so their phrases are never missing. */
  const practiceCardsReady = useCallback(() => pending.current, []);

  const markPhraseUsed = useCallback(async (card: PracticeCard) => {
    const { error } = await supabase.from("srs_cards").update(scheduleReview(card, 4)).eq("id", card.id);
    if (error) return;
    void recordActivity("card_review", `card_review:${card.id}:${card.review_count}`);
    track("card_reviewed");
  }, [recordActivity]);

  return { practiceCards, loadPracticeCards, practiceCardsReady, markPhraseUsed };
};
