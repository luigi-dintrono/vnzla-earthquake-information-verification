import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RawItem } from "@/lib/types";
import { augment, type Augmented } from "@/lib/process/augment";
import { embed } from "@/lib/process/embed";

/**
 * The dedup / corroboration engine.
 *
 * For each raw item: augment -> embed -> find the nearest existing report.
 *   - match found  -> attach (this is how "reportado por N fuentes" grows)
 *   - no match     -> create a new report
 *
 * Matching uses pgvector cosine similarity when embeddings are available, and
 * Postgres trigram similarity otherwise. A same-state guard prevents merging the
 * same KIND of event across different cities.
 */

const VECTOR_THRESHOLD = 0.82;
const TRGM_THRESHOLD = 0.42;

const nowIso = () => new Date().toISOString();
const vecLiteral = (e: number[] | null) => (e ? JSON.stringify(e) : null);

interface MatchRow {
  id: string;
  similarity: number;
}

async function findMatch(
  db: SupabaseClient,
  augmented: Augmented,
  embedding: number[] | null,
): Promise<MatchRow | null> {
  let rows: MatchRow[] = [];

  if (embedding) {
    const { data, error } = await db.rpc("match_reports", {
      query_embedding: vecLiteral(embedding),
      match_threshold: VECTOR_THRESHOLD,
      match_count: 5,
    });
    if (error) throw error;
    rows = (data as MatchRow[]) ?? [];
  } else {
    const { data, error } = await db.rpc("match_reports_trgm", {
      query_text: augmented.canonical_text,
      match_threshold: TRGM_THRESHOLD,
      match_count: 5,
    });
    if (error) throw error;
    rows = (data as MatchRow[]) ?? [];
  }

  if (!rows.length) return null;

  // Same-state guard: don't merge events from different states.
  const ids = rows.map((r) => r.id);
  const { data: reps } = await db.from("reports").select("id, state").in("id", ids);
  const stateById = new Map<string, string | null>((reps ?? []).map((r) => [r.id, r.state]));

  for (const r of rows) {
    const candState = stateById.get(r.id);
    if (augmented.state && candState && augmented.state !== candState) continue;
    return r;
  }
  return null;
}

async function attachToReport(
  db: SupabaseClient,
  reportId: string,
  rawItem: RawItem,
  augmented: Augmented,
  embedding: number[] | null,
  similarity: number,
): Promise<void> {
  await db.from("report_items").insert({
    report_id: reportId,
    raw_item_id: rawItem.id,
    similarity,
  });

  await db
    .from("raw_items")
    .update({ status: "processed", report_id: reportId, similarity })
    .eq("id", rawItem.id);

  // Backfill any fields the existing report is missing.
  const { data: existing } = await db
    .from("reports")
    .select(
      "last_seen_at, summary, location_text, municipality, state, building_name, lat, lng, occurred_at, severity, embedding",
    )
    .eq("id", reportId)
    .single();

  if (!existing) return;

  const patch: Record<string, unknown> = { updated_at: nowIso() };
  const fill = (key: string, current: unknown, next: unknown) => {
    if ((current === null || current === undefined) && next !== null && next !== undefined) {
      patch[key] = next;
    }
  };
  fill("summary", existing.summary, augmented.summary);
  fill("location_text", existing.location_text, augmented.location_text);
  fill("municipality", existing.municipality, augmented.municipality);
  fill("state", existing.state, augmented.state);
  fill("building_name", existing.building_name, augmented.building_name);
  fill("lat", existing.lat, augmented.lat);
  fill("lng", existing.lng, augmented.lng);
  fill("occurred_at", existing.occurred_at, augmented.occurred_at);
  fill("severity", existing.severity, augmented.severity);
  if (!existing.embedding && embedding) patch.embedding = vecLiteral(embedding);

  const captured = rawItem.captured_at;
  if (captured && captured > existing.last_seen_at) patch.last_seen_at = captured;

  await db.from("reports").update(patch).eq("id", reportId);
  await db.rpc("recount_report", { rid: reportId });
}

async function createReport(
  db: SupabaseClient,
  rawItem: RawItem,
  augmented: Augmented,
  embedding: number[] | null,
): Promise<string> {
  const seen = rawItem.captured_at ?? nowIso();
  const { data, error } = await db
    .from("reports")
    .insert({
      title: augmented.title,
      summary: augmented.summary,
      canonical_text: augmented.canonical_text,
      category: augmented.category,
      status: "unverified",
      location_text: augmented.location_text,
      municipality: augmented.municipality,
      state: augmented.state,
      building_name: augmented.building_name,
      lat: augmented.lat,
      lng: augmented.lng,
      severity: augmented.severity,
      occurred_at: augmented.occurred_at,
      embedding: vecLiteral(embedding),
      report_count: 1,
      source_count: 1,
      first_seen_at: seen,
      last_seen_at: seen,
    })
    .select("id")
    .single();

  if (error) throw error;
  const reportId = data!.id as string;

  await db.from("report_items").insert({
    report_id: reportId,
    raw_item_id: rawItem.id,
    similarity: 1,
  });
  await db
    .from("raw_items")
    .update({ status: "processed", report_id: reportId, similarity: 1 })
    .eq("id", rawItem.id);
  await db.rpc("recount_report", { rid: reportId });

  return reportId;
}

export interface ProcessOutcome {
  reportId: string;
  matched: boolean;
  similarity: number;
}

export async function processOne(rawItem: RawItem, db: SupabaseClient = supabaseAdmin()): Promise<ProcessOutcome> {
  const augmented = await augment(rawItem.raw_text, rawItem.captured_at);
  const embedding = await embed(augmented.canonical_text);
  const match = await findMatch(db, augmented, embedding);

  if (match) {
    await attachToReport(db, match.id, rawItem, augmented, embedding, match.similarity);
    return { reportId: match.id, matched: true, similarity: match.similarity };
  }
  const reportId = await createReport(db, rawItem, augmented, embedding);
  return { reportId, matched: false, similarity: 0 };
}

export interface ProcessSummary {
  processed: number;
  created: number;
  matched: number;
  failed: number;
}

/** Process pending raw items (the "process" cron). */
export async function processPending(limit = 50): Promise<ProcessSummary> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("raw_items")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const items = (data as RawItem[]) ?? [];
  const summary: ProcessSummary = { processed: 0, created: 0, matched: 0, failed: 0 };

  for (const item of items) {
    try {
      const outcome = await processOne(item, db);
      summary.processed++;
      if (outcome.matched) summary.matched++;
      else summary.created++;
    } catch (e) {
      summary.failed++;
      console.error(`[process] item ${item.id} failed:`, (e as Error).message);
      await db.from("raw_items").update({ status: "rejected" }).eq("id", item.id);
    }
  }
  return summary;
}

/** Process a single raw item by id (used right after a public submission). */
export async function processRawItemById(id: string): Promise<ProcessOutcome | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("raw_items").select("*").eq("id", id).single();
  if (error || !data) return null;
  return processOne(data as RawItem, db);
}
