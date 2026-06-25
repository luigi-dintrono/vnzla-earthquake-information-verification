/**
 * Central environment access + capability flags.
 *
 * Server-only secrets (service role key, API keys, cookie/cron secrets) are
 * referenced here too, but Next.js only inlines `NEXT_PUBLIC_*` into the client
 * bundle — every other field resolves to `undefined` in the browser, so nothing
 * sensitive leaks. Still, only import the admin client / pipeline on the server.
 */

const read = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

export const env = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: read("SUPABASE_SERVICE_ROLE_KEY"),

  anthropicKey: read("ANTHROPIC_API_KEY"),
  anthropicModel: read("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001",

  openaiKey: read("OPENAI_API_KEY"),
  embeddingModel: read("EMBEDDING_MODEL") ?? "text-embedding-3-small",

  cookieSecret: read("VERIFY_COOKIE_SECRET") ?? "dev-insecure-change-me",
  cronSecret: read("CRON_SECRET") ?? "dev-insecure-change-me",

  xConnectorEnabled: read("X_CONNECTOR_ENABLED") === "true",
} as const;

/** Embedding dimension is fixed in the SQL schema (vector(1536)). */
export const EMBEDDING_DIM = 1536;

export const hasSupabase = (): boolean =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasSupabaseAdmin = (): boolean =>
  Boolean(env.supabaseUrl && env.supabaseServiceKey);
export const hasAnthropic = (): boolean => Boolean(env.anthropicKey);
export const hasOpenAI = (): boolean => Boolean(env.openaiKey);
