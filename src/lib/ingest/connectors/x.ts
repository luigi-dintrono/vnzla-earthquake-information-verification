import type { Source } from "@/lib/types";
import type { RawItemInput } from "@/lib/ingest/types";
import { env } from "@/lib/env";
import { fetchRssUrl } from "./rss";

/**
 * X / Twitter connector — DISABLED by default.
 *
 * We deliberately do NOT ship a scraper: scraping X violates its Terms of
 * Service and breaks constantly. Instead this connector is a thin, legal-by-
 * default adapter that reads each account's posts as an RSS/Atom feed. To
 * enable it:
 *
 *   1. Set X_CONNECTOR_ENABLED=true
 *   2. Provide a feed for each account, in priority order:
 *        a. source.config.feedUrl — an explicit per-account feed URL, or
 *        b. X_FEED_GATEWAY + the account's handle — a gateway YOU operate that
 *           turns a handle into an RSS feed (e.g. a Nitter base URL). Put a
 *           "{handle}" placeholder in the gateway, or give just a base and we
 *           append "/{handle}/rss".
 *
 * Either way the same RawItemInput contract applies, so dedup/verify just work.
 * Swapping in the official X API later means replacing only this file.
 */
export async function fetchX(source: Source): Promise<RawItemInput[]> {
  if (!env.xConnectorEnabled) {
    console.info(`[ingest] X connector disabled; skipping "${source.name}".`);
    return [];
  }

  const feedUrl = resolveFeedUrl(source);
  if (!feedUrl) {
    console.warn(
      `[ingest] X source "${source.name}" has no feed. Set config.feedUrl on ` +
        `the source, or set X_FEED_GATEWAY and give the source a handle.`,
    );
    return [];
  }

  const handle = source.handle?.trim().replace(/^@/, "");
  const items = await fetchRssUrl(feedUrl, source);
  // Store the canonical x.com URL + tweet-id key so entries (and their links)
  // survive the gateway going away — they live durably in raw_items either way.
  return items.map((it) => canonicalize(it, handle));
}

/** Pick an RSS feed for an X source: explicit per-source URL, else gateway+handle. */
function resolveFeedUrl(source: Source): string | null {
  const explicit = (source.config?.feedUrl as string | undefined)?.trim();
  if (explicit) return explicit;

  const handle = source.handle?.trim().replace(/^@/, "");
  const gateway = env.xFeedGateway;
  if (!handle || !gateway) return null;

  return gateway.includes("{handle}")
    ? gateway.replaceAll("{handle}", handle)
    : `${gateway.replace(/\/+$/, "")}/${handle}/rss`;
}

/**
 * Rewrite a gateway post URL (e.g. Nitter) to its canonical x.com form and key
 * dedup on the numeric tweet id, so a stored entry's link keeps working and
 * re-crawls via a different gateway host don't duplicate it.
 */
function canonicalize(item: RawItemInput, handle?: string): RawItemInput {
  const match = (item.raw_url ?? "").match(/\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/);
  if (!match) return item;

  const [, urlHandle, statusId] = match;
  const account = handle || urlHandle;
  return {
    ...item,
    raw_url: `https://x.com/${account}/status/${statusId}`,
    external_id: `x_${statusId}`,
    author: item.author?.startsWith("@") ? item.author : `@${account}`,
  };
}
