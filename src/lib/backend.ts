import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import type { Database } from "./database.types";

/** Neon Auth for sign-in and the Neon Data API for table access (RLS applies). */
export const backend = createClient<Database>({
  auth: { adapter: SupabaseAuthAdapter(), url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});

type AuthSession = Awaited<ReturnType<typeof backend.auth.getSession>>["data"]["session"];
export type Session = NonNullable<AuthSession>;
export type User = Session["user"];
