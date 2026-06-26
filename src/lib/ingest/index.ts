import { createHash } from "crypto";
import { query, queryOne } from "@/lib/db";
import type { Source, SourceType } from "@/lib/types";
import type { Connector, RawItemInput } from "@/lib/ingest/types";
import { fetchRss } from "./connectors/rss";
import { fetchX } from "./connectors/x";

function connectorFor(type: SourceType): Connector | null {
  switch (type) {
    case "rss":
    case "news":
      return fetchRss;
    case "x":
      return fetchX;
    case "manual":
    case "other":
    default:
      return null; // manual items arrive via the submission form, not crawling
  }
}

function externalIdFor(input: RawItemInput): string {
  const explicit = input.external_id?.trim();
  if (explicit) return explicit;
  // Stable hash of the text so re-crawls of the same content don't duplicate.
  return "h_" + createHash("sha1").update(input.raw_text).digest("hex").slice(0, 24);
}

async function insertItems(
  source: Source,
  items: RawItemInput[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const it of items) {
    const external_id = externalIdFor(it);
    const existing = await queryOne(
      "SELECT id FROM raw_items WHERE source_id = $1 AND external_id = $2 LIMIT 1",
      [source.id, external_id],
    );
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await query(
        `INSERT INTO raw_items (source_id, external_id, author, raw_text, raw_url, lang, media, captured_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending')`,
        [
          source.id,
          external_id,
          it.author ?? null,
          it.raw_text,
          it.raw_url ?? null,
          it.lang ?? null,
          JSON.stringify(it.media ?? []),
          it.captured_at ?? null,
        ],
      );
      inserted++;
    } catch (e) {
      skipped++;
      console.error(`[ingest] insert failed for "${source.name}":`, (e as Error).message);
    }
  }

  return { inserted, skipped };
}

export interface IngestSummary {
  sources: number;
  fetched: number;
  inserted: number;
  skipped: number;
}

export interface IngestOptions {
  /** Only keep items captured within the last N hours (e.g. 12). */
  sinceHours?: number;
}

/** Drop items older than the cutoff. Undated items are kept (feeds rarely omit dates). */
function withinWindow(items: RawItemInput[], cutoffMs: number | null): RawItemInput[] {
  if (cutoffMs === null) return items;
  return items.filter((it) => {
    if (!it.captured_at) return true;
    const t = Date.parse(it.captured_at);
    return Number.isNaN(t) || t >= cutoffMs;
  });
}

/** Crawl all active sources and stage new items as pending raw_items. */
export async function runIngest(options: IngestOptions = {}): Promise<IngestSummary> {
  const cutoffMs =
    options.sinceHours && options.sinceHours > 0
      ? Date.now() - options.sinceHours * 3_600_000
      : null;

  const sources = await query<Source>("SELECT * FROM sources WHERE active = true");
  const summary: IngestSummary = { sources: 0, fetched: 0, inserted: 0, skipped: 0 };

  for (const source of sources) {
    const connector = connectorFor(source.type);
    if (!connector) continue;
    summary.sources++;
    try {
      const items = withinWindow(await connector(source), cutoffMs);
      summary.fetched += items.length;
      const { inserted, skipped } = await insertItems(source, items);
      summary.inserted += inserted;
      summary.skipped += skipped;
    } catch (e) {
      console.error(`[ingest] source "${source.name}" failed:`, (e as Error).message);
    }
  }

  return summary;
}
