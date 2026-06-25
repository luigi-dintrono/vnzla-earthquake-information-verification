import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous browser client, used only for Realtime subscriptions on the live
 * feed. Reads the public env vars Next.js inlines at build time. Returns `null`
 * when Supabase isn't configured.
 */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
