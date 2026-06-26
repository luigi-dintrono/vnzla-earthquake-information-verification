import { hasDatabase, query, queryOne } from "@/lib/db";
import type {
  Report,
  ReportCategory,
  ReportSource,
  ReportStatus,
  Source,
  SourceType,
  Verification,
  VoteType,
} from "@/lib/types";

export type FeedSort = "recent" | "corroborated" | "discussed";

export interface FeedFilters {
  category?: ReportCategory;
  status?: ReportStatus;
  state?: string;
  q?: string;
  sort?: FeedSort;
  limit?: number;
  /** true = demo feed, false = real feed, undefined = both. */
  demo?: boolean;
}

export async function getFeed(filters: FeedFilters = {}): Promise<Report[]> {
  if (!hasDatabase()) return [];

  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.demo !== undefined) {
    where.push(`is_demo = $${i++}`);
    params.push(filters.demo);
  }
  if (filters.category) {
    where.push(`category = $${i++}`);
    params.push(filters.category);
  }
  if (filters.status) {
    where.push(`status = $${i++}`);
    params.push(filters.status);
  }
  if (filters.state) {
    where.push(`state = $${i++}`);
    params.push(filters.state);
  }
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.push(
        `(title ILIKE $${i} OR summary ILIKE $${i} OR location_text ILIKE $${i} OR building_name ILIKE $${i})`,
      );
      params.push(`%${q}%`);
      i++;
    }
  }

  const orderBy =
    filters.sort === "corroborated"
      ? "report_count DESC, last_seen_at DESC"
      : filters.sort === "discussed"
        ? "confirm_count DESC, dispute_count DESC"
        : "last_seen_at DESC";

  params.push(filters.limit ?? 60);
  const sql = `SELECT * FROM reports ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${orderBy} LIMIT $${i}`;

  try {
    return await query<Report>(sql, params);
  } catch (e) {
    console.error("[queries.getFeed]", (e as Error).message);
    return [];
  }
}

export async function getReport(id: string): Promise<Report | null> {
  if (!hasDatabase()) return null;
  try {
    return await queryOne<Report>("SELECT * FROM reports WHERE id = $1", [id]);
  } catch (e) {
    console.error("[queries.getReport]", (e as Error).message);
    return null;
  }
}

interface SourceRow {
  raw_item_id: string;
  similarity: number | null;
  author: string | null;
  raw_url: string | null;
  captured_at: string | null;
  source_name: string | null;
  source_type: SourceType | null;
}

export async function getReportSources(id: string): Promise<ReportSource[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await query<SourceRow>(
      `SELECT ri.raw_item_id, ri.similarity, it.author, it.raw_url, it.captured_at,
              s.name AS source_name, s.type AS source_type
       FROM report_items ri
       JOIN raw_items it ON it.id = ri.raw_item_id
       LEFT JOIN sources s ON s.id = it.source_id
       WHERE ri.report_id = $1
       ORDER BY ri.similarity DESC NULLS LAST`,
      [id],
    );
    return rows.map((r) => ({
      raw_item_id: r.raw_item_id,
      similarity: r.similarity,
      author: r.author,
      raw_url: r.raw_url,
      captured_at: r.captured_at,
      source_name: r.source_name,
      source_type: (r.source_type ?? "other") as SourceType,
    }));
  } catch (e) {
    console.error("[queries.getReportSources]", (e as Error).message);
    return [];
  }
}

export async function getReportComments(id: string, limit = 20): Promise<Verification[]> {
  if (!hasDatabase()) return [];
  try {
    return await query<Verification>(
      `SELECT id, report_id, voter_hash, vote, comment, evidence_url, created_at
       FROM verifications
       WHERE report_id = $1 AND comment IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit],
    );
  } catch (e) {
    console.error("[queries.getReportComments]", (e as Error).message);
    return [];
  }
}

export async function getMyVote(reportId: string, voterHash: string | null): Promise<VoteType | null> {
  if (!voterHash || !hasDatabase()) return null;
  try {
    const row = await queryOne<{ vote: VoteType }>(
      "SELECT vote FROM verifications WHERE report_id = $1 AND voter_hash = $2",
      [reportId, voterHash],
    );
    return row?.vote ?? null;
  } catch {
    return null;
  }
}

export async function getStates(demo?: boolean): Promise<string[]> {
  if (!hasDatabase()) return [];
  try {
    const rows =
      demo === undefined
        ? await query<{ state: string }>(
            "SELECT DISTINCT state FROM reports WHERE state IS NOT NULL ORDER BY state",
          )
        : await query<{ state: string }>(
            "SELECT DISTINCT state FROM reports WHERE state IS NOT NULL AND is_demo = $1 ORDER BY state",
            [demo],
          );
    return rows.map((r) => r.state);
  } catch {
    return [];
  }
}

export interface SourceOverview extends Source {
  item_count: number;
  last_item_at: string | null;
}

/** Every source plus how much we've crawled from it — powers the admin visibility list. */
export async function getSourcesOverview(): Promise<SourceOverview[]> {
  if (!hasDatabase()) return [];
  try {
    return await query<SourceOverview>(
      `SELECT s.*,
              (SELECT count(*) FROM raw_items ri WHERE ri.source_id = s.id)::int AS item_count,
              (SELECT max(captured_at) FROM raw_items ri WHERE ri.source_id = s.id) AS last_item_at
       FROM sources s
       ORDER BY s.active DESC, s.trust_weight DESC, s.type, s.name`,
    );
  } catch (e) {
    console.error("[queries.getSourcesOverview]", (e as Error).message);
    return [];
  }
}

export interface Stats {
  reports: number;
  verified: number;
  sources: number;
  verifications: number;
}

export async function getStats(demo?: boolean): Promise<Stats> {
  const empty = { reports: 0, verified: 0, sources: 0, verifications: 0 };
  if (!hasDatabase()) return empty;
  try {
    // Scope report/verification counts to the feed; "sources" = active sources
    // that actually feed it (real feed = crawlable sources; demo = all).
    const row = await queryOne<Stats>(
      `SELECT
         (SELECT count(*) FROM reports WHERE ($1::boolean IS NULL OR is_demo = $1))::int AS reports,
         (SELECT count(*) FROM reports WHERE status = 'verified' AND ($1::boolean IS NULL OR is_demo = $1))::int AS verified,
         (SELECT count(*) FROM sources WHERE active AND ($1::boolean IS NULL OR ($1 = false AND type <> 'manual') OR $1 = true))::int AS sources,
         (SELECT count(*) FROM verifications v WHERE EXISTS (
            SELECT 1 FROM reports r WHERE r.id = v.report_id AND ($1::boolean IS NULL OR r.is_demo = $1)
         ))::int AS verifications`,
      [demo ?? null],
    );
    return row ?? empty;
  } catch (e) {
    console.error("[queries.getStats]", (e as Error).message);
    return empty;
  }
}
