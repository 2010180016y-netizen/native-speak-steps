import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { scheduleReview, type SrsState } from "@/lib/srs";
import { track } from "@/lib/analytics";

/**
 * Saves one review of a card: its next SM-2 schedule, a row in the review log (card_reviews)
 * and the activity that earns XP and keeps the streak. Every review screen goes through here.
 * Resolves to false when the schedule could not be saved.
 */
export const useCardReview = () => {
  const recordActivity = useRecordActivity();

  return useCallback(
    async (card: SrsState & { id: string }, quality: number) => {
      const next = scheduleReview(card, quality);
      const { error } = await supabase.from("srs_cards").update(next).eq("id", card.id);
      if (error) return false;

      // Keyed by the card's review count, so a retried review is logged once.
      void supabase
        .from("card_reviews")
        .upsert(
          {
            card_id: card.id,
            review_number: card.review_count,
            quality,
            interval_before: card.interval_days,
            interval_after: next.interval_days,
          },
          { onConflict: "card_id,review_number", ignoreDuplicates: true },
        )
        .then(({ error: logError }) => {
          if (logError) console.warn("review log not saved:", logError.message);
        });
      void recordActivity("card_review", `card_review:${card.id}:${card.review_count}`);
      track("card_reviewed");
      return true;
    },
    [recordActivity],
  );
};
