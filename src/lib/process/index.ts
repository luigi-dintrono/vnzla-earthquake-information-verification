import { query, queryOne } from "@/lib/db";
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
// Trigram is conservative on paraphrased Spanish; 0.3 catches near-dupes while
// the same-state guard + location-anchored canonical_text limit false merges.
const TRGM_THRESHOLD = 0.3;

const nowIso = () => new Date().toISOString();
const vecLiteral = (e: number[] | null) => (e ? JSON.stringify(e) : null);

interface MatchRow {
  id: string;
  similarity: number;
}

async function findMatch(augmented: Augmented, embedding: number[] | null): Promise<MatchRow | null> {
  const rows = embedding
    ? await query<MatchRow>("SELECT id, similarity FROM match_reports($1::vector, $2, $3)", [
        vecLiteral(embedding),
        VECTOR_THRESHOLD,
        5,
      ])
    : await query<MatchRow>("SELECT id, similarity FROM match_reports_trgm($1, $2, $3)", [
        augmented.canonical_text,
        TRGM_THRESHOLD,
        5,
      ]);

  if (!rows.length) return null;

  // Same-state guard: don't merge events from different states.
  const ids = rows.map((r) => r.id);
  const stateRows = await query<{ id: string; state: string | null }>(
    "SELECT id, state FROM reports WHERE id = ANY($1::uuid[])",
    [ids],
  );
  const stateById = new Map(stateRows.map((r) => [r.id, r.state]));

  for (const r of rows) {
    const candState = stateById.get(r.id);
    if (augmented.state && candState && augmented.state !== candState) continue;
    return r;
  }
  return null;
}

async function attachToReport(
  reportId: string,
  rawItem: RawItem,
  augmented: Augmented,
  embedding: number[] | null,
  similarity: number,
): Promise<void> {
  await query("INSERT INTO report_items (report_id, raw_item_id, similarity) VALUES ($1, $2, $3)", [
    reportId,
    rawItem.id,
    similarity,
  ]);
  await query("UPDATE raw_items SET status = 'processed', report_id = $1, similarity = $2 WHERE id = $3", [
    reportId,
    similarity,
    rawItem.id,
  ]);

  // Backfill any fields the existing report is missing; advance last_seen_at.
  await query(
    `UPDATE reports SET
       summary       = COALESCE(summary, $2),
       location_text = COALESCE(location_text, $3),
       municipality  = COALESCE(municipality, $4),
       state         = COALESCE(state, $5),
       building_name = COALESCE(building_name, $6),
       lat           = COALESCE(lat, $7),
       lng           = COALESCE(lng, $8),
       occurred_at   = COALESCE(occurred_at, $9),
       severity      = COALESCE(severity, $10),
       embedding     = COALESCE(embedding, $11::vector),
       last_seen_at  = GREATEST(last_seen_at, $12::timestamptz),
       updated_at    = now()
     WHERE id = $1`,
    [
      reportId,
      augmented.summary,
      augmented.location_text,
      augmented.municipality,
      augmented.state,
      augmented.building_name,
      augmented.lat,
      augmented.lng,
      augmented.occurred_at,
      augmented.severity,
      vecLiteral(embedding),
      rawItem.captured_at,
    ],
  );

  await query("SELECT recount_report($1)", [reportId]);
}

async function createReport(
  rawItem: RawItem,
  augmented: Augmented,
  embedding: number[] | null,
): Promise<string> {
  const seen = rawItem.captured_at ?? nowIso();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO reports
       (title, summary, canonical_text, category, status, location_text, municipality, state,
        building_name, lat, lng, severity, occurred_at, embedding, report_count, source_count,
        first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, 'unverified', $5, $6, $7, $8, $9, $10, $11, $12, $13::vector, 1, 1, $14, $14)
     RETURNING id`,
    [
      augmented.title,
      augmented.summary,
      augmented.canonical_text,
      augmented.category,
      augmented.location_text,
      augmented.municipality,
      augmented.state,
      augmented.building_name,
      augmented.lat,
      augmented.lng,
      augmented.severity,
      augmented.occurred_at,
      vecLiteral(embedding),
      seen,
    ],
  );
  const reportId = row!.id;

  await query("INSERT INTO report_items (report_id, raw_item_id, similarity) VALUES ($1, $2, 1)", [
    reportId,
    rawItem.id,
  ]);
  await query("UPDATE raw_items SET status = 'processed', report_id = $1, similarity = 1 WHERE id = $2", [
    reportId,
    rawItem.id,
  ]);
  await query("SELECT recount_report($1)", [reportId]);

  return reportId;
}

export interface ProcessOutcome {
  reportId: string;
  matched: boolean;
  similarity: number;
}

export async function processOne(rawItem: RawItem): Promise<ProcessOutcome> {
  const augmented = await augment(rawItem.raw_text, rawItem.captured_at);
  const embedding = await embed(augmented.canonical_text);
  const match = await findMatch(augmented, embedding);

  if (match) {
    await attachToReport(match.id, rawItem, augmented, embedding, match.similarity);
    return { reportId: match.id, matched: true, similarity: match.similarity };
  }
  const reportId = await createReport(rawItem, augmented, embedding);
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
  const items = await query<RawItem>(
    "SELECT * FROM raw_items WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1",
    [limit],
  );
  const summary: ProcessSummary = { processed: 0, created: 0, matched: 0, failed: 0 };

  for (const item of items) {
    try {
      const outcome = await processOne(item);
      summary.processed++;
      if (outcome.matched) summary.matched++;
      else summary.created++;
    } catch (e) {
      summary.failed++;
      console.error(`[process] item ${item.id} failed:`, (e as Error).message);
      await query("UPDATE raw_items SET status = 'rejected' WHERE id = $1", [item.id]).catch(() => {});
    }
  }
  return summary;
}

/** Process a single raw item by id (used right after a public submission). */
export async function processRawItemById(id: string): Promise<ProcessOutcome | null> {
  const item = await queryOne<RawItem>("SELECT * FROM raw_items WHERE id = $1", [id]);
  if (!item) return null;
  return processOne(item);
}
