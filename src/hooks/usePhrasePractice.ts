import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { scheduleReview } from "@/lib/srs";
import { track } from "@/lib/analytics";
import { pickPracticeCards, type PracticeCard } from "@/lib/phrasePractice";

/** Due cards to practise in conversation; using a phrase counts as a successful review. */
export const usePhrasePractice = () => {
  const { user } = useAuth();
  const recordActivity = useRecordActivity();
  const [practiceCards, setPracticeCards] = useState<PracticeCard[]>([]);

  const loadPracticeCards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("srs_cards")
      .select("id, target_text, ease_factor, interval_days, review_count")
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at")
      .limit(30);
    setPracticeCards(pickPracticeCards(data ?? []));
  }, [user]);

  const markPhraseUsed = useCallback(async (card: PracticeCard) => {
    const { error } = await supabase.from("srs_cards").update(scheduleReview(card, 4)).eq("id", card.id);
    if (error) return;
    void recordActivity("card_review", `card_review:${card.id}:${card.review_count}`);
    track("card_reviewed");
  }, [recordActivity]);

  return { practiceCards, loadPracticeCards, markPhraseUsed };
};
