import { useState, useEffect } from "react";
import { backend, type Session, type User } from "@/lib/backend";
import type { Tables } from "@/lib/database.types";
import { track } from "@/lib/analytics";
import { browserTimeZone } from "@/lib/streak";
import { AuthContext } from "@/hooks/useAuth";

type Profile = Tables<"profiles">;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ensure_profile() returns the profile, creating it on the first sign-in (the name comes from sign-up).
  const fetchProfile = async () => {
    const { data, error } = await backend.rpc("ensure_profile");
    if (error) console.warn("profile not loaded:", error.message);
    setProfile(data ?? null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile();
  };

  useEffect(() => {
    const { data: { subscription } } = backend.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    backend.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) track("app_opened");
  }, [userId]);

  // Reminders fire in the profile's time zone, so keep it the device's from the first visit on.
  const profileTimeZone = profile?.timezone;
  useEffect(() => {
    const timeZone = browserTimeZone();
    if (!userId || !profileTimeZone || !timeZone || timeZone === profileTimeZone) return;
    backend
      .from("profiles")
      .update({ timezone: timeZone })
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) console.warn("time zone not saved:", error.message);
        else setProfile((p) => (p ? { ...p, timezone: timeZone } : p));
      });
  }, [userId, profileTimeZone]);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await backend.auth.signUp({
      email,
      password,
      options: {
        data: { name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    // Until the email is verified there is no session, which the adapter reports as an error.
    if (error && error.code !== "session_not_found") throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await backend.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await backend.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await backend
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (error) throw error;
    await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
