import { supabase } from "@/integrations/supabase/client";

// Product funnel events (PRD-2). Definitions and the cohort view: docs/metrics.md.
export type AnalyticsEvent =
  | "app_opened"
  | "onboarding_completed"
  | "import_analyzed"
  | "cards_saved"
  | "card_reviewed"
  | "chat_completed"
  | "speaking_completed";

/** Records an event for the signed-in user; at most one row per user, event and day. Never throws. */
export function track(event: AnalyticsEvent) {
  supabase
    .from("analytics_events")
    .upsert({ event }, { onConflict: "user_id,event,event_date", ignoreDuplicates: true })
    .then(({ error }) => {
      if (error) console.warn("analytics event not recorded:", event, error.message);
    });
}
