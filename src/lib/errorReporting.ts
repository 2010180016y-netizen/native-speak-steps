import { supabase } from "@/integrations/supabase/client";

// ponytail: errors land in our own client_errors table with no alerting or grouping;
// move to a hosted tracker (e.g. Sentry) once someone needs alerts.
const MAX_REPORTS_PER_PAGE = 20;
let reportCount = 0;

/** Stores a client error for the signed-in user. Never throws. */
export async function reportError(error: unknown) {
  if (reportCount >= MAX_REPORTS_PER_PAGE) return;
  reportCount++;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const err = error instanceof Error ? error : new Error(String(error));
  await supabase.from("client_errors").insert({
    message: err.message.slice(0, 2000) || "(no message)",
    stack: err.stack?.slice(0, 8000) ?? null,
    // Path only: query strings and hashes can carry auth tokens (e.g. password reset links).
    url: (window.location.origin + window.location.pathname).slice(0, 500),
    user_agent: navigator.userAgent.slice(0, 500),
  });
}

export function installGlobalErrorReporting() {
  window.addEventListener("error", (event) => void reportError(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => void reportError(event.reason));
}
