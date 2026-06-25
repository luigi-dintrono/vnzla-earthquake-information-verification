import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  db: SupabaseClient,
  source: Source,
  items: RawItemInput[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const it of items) {
    const external_id = externalIdFor(it);
    const { data: existing } = await db
      .from("raw_items")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_id", external_id)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await db.from("raw_items").insert({
      source_id: source.id,
      external_id,
      author: it.author ?? null,
      raw_text: it.raw_text,
      raw_url: it.raw_url ?? null,
      lang: it.lang ?? null,
      media: it.media ?? [],
      captured_at: it.captured_at ?? null,
      status: "pending",
    });

    if (error) {
      skipped++;
      console.error(`[ingest] insert failed for "${source.name}":`, error.message);
    } else {
      inserted++;
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

/** Crawl all active sources and stage new items as pending raw_items. */
export async function runIngest(): Promise<IngestSummary> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("sources").select("*").eq("active", true);
  if (error) throw error;

  const sources = (data as Source[]) ?? [];
  const summary: IngestSummary = { sources: 0, fetched: 0, inserted: 0, skipped: 0 };

  for (const source of sources) {
    const connector = connectorFor(source.type);
    if (!connector) continue;
    summary.sources++;
    try {
      const items = await connector(source);
      summary.fetched += items.length;
      const { inserted, skipped } = await insertItems(db, source, items);
      summary.inserted += inserted;
      summary.skipped += skipped;
    } catch (e) {
      console.error(`[ingest] source "${source.name}" failed:`, (e as Error).message);
    }
  }

  return summary;
}
