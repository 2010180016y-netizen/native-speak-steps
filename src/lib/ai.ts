import { toast, type ExternalToast } from "sonner";
import { backend } from "@/lib/backend";
import { track } from "@/lib/analytics";

/** An AI function failure with the reason the server gave (api/_lib/ai.ts). */
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
 * Calls a server function in api/ as the signed-in user; `T` is the JSON it returns.
 * Server-explained failures come back as AiError. When the daily quota is used up it also shows
 * the paywall (BIZ-1), so callers must not add their own toast.
 */
export async function invokeAi<T>(name: string, options?: { body?: unknown }): Promise<AiResult<T>> {
  let res: Response;
  try {
    const { data: { session } } = await backend.auth.getSession();
    res = await fetch(`/api/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(options?.body ?? {}),
    });
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }

  const payload = await res.json().catch(() => null);
  if (res.ok) return { data: payload as T, error: null };
  if (typeof payload?.error !== "string") return { data: null, error: new Error(`${name} failed with ${res.status}`) };

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
