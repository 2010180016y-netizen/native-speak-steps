import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

/**
 * Calls an AI edge function. When the user's daily quota is used up, shows the
 * server's message with a link to the Pro upgrade (the paywall, BIZ-1).
 */
export async function invokeAi<T = any>(name: string, options?: { body?: unknown }) {
  const result = await supabase.functions.invoke<T>(name, options as { body?: Record<string, unknown> });
  if (result.error instanceof FunctionsHttpError && result.error.context.status === 429) {
    const payload = await result.error.context.clone().json().catch(() => null);
    if (payload?.error_type === "quota_exceeded") {
      track("paywall_shown");
      toast.error(payload.error, {
        id: "ai-quota",
        action: { label: "Pro 보기", onClick: () => window.location.assign("/upgrade") },
      });
    }
  }
  return result;
}
