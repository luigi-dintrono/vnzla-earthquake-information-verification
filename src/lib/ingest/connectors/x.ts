import type { Source } from "@/lib/types";
import type { RawItemInput } from "@/lib/ingest/types";
import { env } from "@/lib/env";
import { fetchRssUrl } from "./rss";

/**
 * X / Twitter connector — DISABLED by default.
 *
 * We deliberately do NOT ship a scraper: scraping X violates its Terms of
 * Service and breaks constantly. Instead this connector is a thin, legal-by-
 * default adapter. To enable it:
 *
 *   1. Set X_CONNECTOR_ENABLED=true
 *   2. On the source row, set config.feedUrl to a gateway YOU operate that
 *      returns the account's posts as an RSS/Atom feed — e.g. the official paid
 *      X API behind a small proxy, or a self-hosted bridge you're licensed to
 *      use. The same RawItemInput contract applies, so dedup/verify just work.
 *
 * Swapping in the official X API later means replacing only this file.
 */
export async function fetchX(source: Source): Promise<RawItemInput[]> {
  if (!env.xConnectorEnabled) {
    console.info(`[ingest] X connector disabled; skipping "${source.name}".`);
    return [];
  }

  const feedUrl = (source.config?.feedUrl as string | undefined)?.trim();
  if (!feedUrl) {
    console.warn(
      `[ingest] X source "${source.name}" is enabled but has no config.feedUrl. ` +
        `Point it at your X data gateway (official API proxy or licensed bridge).`,
    );
    return [];
  }

  return fetchRssUrl(feedUrl, source);
}
