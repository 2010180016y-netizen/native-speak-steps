import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tracks user session: start/end times, duration, activity type.
 * Automatically ends session on page unload/visibility change.
 */
export const useSessionTracker = (activityType: string = "general") => {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const startSession = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: user.id,
          activity_type: activityType,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!error && data) {
        sessionIdRef.current = data.id;
        startTimeRef.current = Date.now();
      }
    } catch (e) {
      console.error("Session start error:", e);
    }
  }, [user, activityType]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !user) return;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      await supabase
        .from("user_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", sessionIdRef.current);
      sessionIdRef.current = null;
    } catch (e) {
      console.error("Session end error:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    startSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        endSession();
      } else if (document.visibilityState === "visible" && !sessionIdRef.current) {
        startSession();
      }
    };

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        // Use sendBeacon for reliable unload tracking
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`;
        navigator.sendBeacon?.(url); // Best-effort
        // Also try regular update
        supabase
          .from("user_sessions")
          .update({ ended_at: new Date().toISOString(), duration_seconds: duration })
          .eq("id", sessionIdRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession();
    };
  }, [user, startSession, endSession]);

  return { endSession };
};
