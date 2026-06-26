/**
 * Central environment access + capability flags.
 *
 * Server-only secrets (DATABASE_URL, API keys, cookie/cron secrets) are
 * referenced here too, but Next.js only inlines `NEXT_PUBLIC_*` into the client
 * bundle — every other field resolves to `undefined` in the browser, so nothing
 * sensitive leaks. Still, only import the db layer / pipeline on the server.
 */

const read = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

const readNum = (key: string, fallback: number): number => {
  const n = Number(read(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  // Neon (or any Postgres) connection string — use the POOLED endpoint.
  databaseUrl: read("DATABASE_URL"),

  anthropicKey: read("ANTHROPIC_API_KEY"),
  anthropicModel: read("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001",

  openaiKey: read("OPENAI_API_KEY"),
  embeddingModel: read("EMBEDDING_MODEL") ?? "text-embedding-3-small",

  cookieSecret: read("VERIFY_COOKIE_SECRET") ?? "dev-insecure-change-me",
  cronSecret: read("CRON_SECRET") ?? "dev-insecure-change-me",

  xConnectorEnabled: read("X_CONNECTOR_ENABLED") === "true",
  // Secret URL segment guarding the admin page (/admin/<slug>). Unset = no
  // admin page is reachable (every slug 404s).
  adminSlug: read("ADMIN_SLUG"),
  // How many hours back the scheduled crawl looks. Default 12 = 2× the 6h
  // cadence, so a delayed/skipped run never leaves a gap. Overlap is free:
  // already-stored items are deduped on (source_id, external_id).
  ingestWindowHours: readNum("INGEST_WINDOW_HOURS", 12),
  // Gateway that turns an X handle into an RSS/Atom feed (e.g. a Nitter base
  // URL). Use "{handle}" as a placeholder, or just give a base — we append
  // "/{handle}/rss". Per-source config.feedUrl overrides this.
  xFeedGateway: read("X_FEED_GATEWAY"),
} as const;

/** Embedding dimension is fixed in the SQL schema (vector(1536)). */
export const EMBEDDING_DIM = 1536;

export const hasDatabase = (): boolean => Boolean(env.databaseUrl);
export const hasAnthropic = (): boolean => Boolean(env.anthropicKey);
export const hasOpenAI = (): boolean => Boolean(env.openaiKey);
