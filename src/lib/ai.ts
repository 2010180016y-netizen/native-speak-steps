import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast, type ExternalToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

/** An AI function failure with the reason the server gave (supabase/functions/_shared/ai.ts). */
export class AiError extends Error {
  constructor(message: string, readonly type: string) {
    super(message);
    this.name = "AiError";
  }
}

/** True when the failure is the daily quota, for which invokeAi() has already shown the paywall. */
export const isPaywallError = (error: unknown) => error instanceof AiError && error.type === "quota_exceeded";

type AiResult<T> = { data: T; error: null } | { data: null; error: Error };

/**
 * Calls an AI edge function; `T` is the JSON it returns. Server-explained failures come back as
 * AiError. When the daily quota is used up it also shows the paywall (BIZ-1), so callers must
 * not add their own toast.
 */
export async function invokeAi<T>(name: string, options?: { body?: unknown }): Promise<AiResult<T>> {
  const result = await supabase.functions.invoke<T>(name, options as { body?: Record<string, unknown> });
  if (!(result.error instanceof FunctionsHttpError)) return result;

  const payload = await result.error.context.json().catch(() => null);
  if (typeof payload?.error !== "string") return result;

  const error = new AiError(payload.error, payload.error_type ?? "unknown");
  if (isPaywallError(error)) {
    track("paywall_shown");
    toast.error(error.message, {
      id: "ai-quota",
      duration: 8000,
      action: { label: "Pro 보기", onClick: () => window.location.assign("/upgrade") },
    });
  }
  return { data: null, error };
}

/** Shows an AI failure unless the paywall already explained it: one message per failure. */
export function toastAiError(error: unknown, message: string, options?: ExternalToast) {
  if (!isPaywallError(error)) toast.error(message, options);
}
