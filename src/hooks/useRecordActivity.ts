import { useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MILESTONE_LIST } from "@/lib/milestones";

export type ActivityKind =
  | "card_review"
  | "chat_message"
  | "chat_mission"
  | "speaking_mission"
  | "speaking_session"
  | "roleplay_complete"
  | "import_analyzed"
  | "cards_saved";

export type ActivityResult = {
  applied: boolean;
  xp: number;
  total_xp: number;
  streak_days: number;
  milestone: { days: number; points: number } | null;
};

const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/**
 * Reports a learning activity to the server (record_activity). XP, streak, daily stats and
 * rewards are computed there; the idempotency key makes retries safe.
 */
export const useRecordActivity = () => {
  const { refreshProfile } = useAuth();

  return useCallback(
    async (kind: ActivityKind, idempotencyKey: string, units = 1): Promise<ActivityResult | null> => {
      const { data, error } = await supabase.rpc("record_activity", {
        p_kind: kind,
        p_idempotency_key: idempotencyKey,
        p_units: units,
        p_timezone: browserTimeZone(),
      });
      if (error) {
        console.error("record_activity failed:", error);
        return null;
      }

      const result = data as unknown as ActivityResult;
      if (result.milestone) {
        const milestone = MILESTONE_LIST.find((m) => m.days === result.milestone!.days);
        if (milestone) toast.success(`${milestone.badge} ${milestone.name} 달성! +${result.milestone.points}P`);
      }
      if (result.applied) void refreshProfile();
      return result;
    },
    [refreshProfile],
  );
};
