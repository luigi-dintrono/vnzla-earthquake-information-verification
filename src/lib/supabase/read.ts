import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Anonymous read client (governed by RLS select policies). Returns `null` when
 * Supabase isn't configured so pages can render a friendly setup state instead
 * of throwing.
 */
export function supabaseRead(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
