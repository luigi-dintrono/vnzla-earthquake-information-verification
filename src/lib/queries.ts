import { supabaseRead } from "@/lib/supabase/read";
import type {
  Report,
  ReportCategory,
  ReportSource,
  ReportStatus,
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
}

export async function getFeed(filters: FeedFilters = {}): Promise<Report[]> {
  const db = supabaseRead();
  if (!db) return [];

  let query = db.from("reports").select("*").limit(filters.limit ?? 60);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.q) {
    const q = filters.q.replace(/[%,]/g, " ").trim();
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,summary.ilike.%${q}%,location_text.ilike.%${q}%,building_name.ilike.%${q}%`,
      );
    }
  }

  switch (filters.sort ?? "recent") {
    case "corroborated":
      query = query.order("report_count", { ascending: false }).order("last_seen_at", { ascending: false });
      break;
    case "discussed":
      query = query.order("confirm_count", { ascending: false }).order("dispute_count", { ascending: false });
      break;
    default:
      query = query.order("last_seen_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("[queries.getFeed]", error.message);
    return [];
  }
  return (data as Report[]) ?? [];
}

export async function getReport(id: string): Promise<Report | null> {
  const db = supabaseRead();
  if (!db) return null;
  const { data, error } = await db.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[queries.getReport]", error.message);
    return null;
  }
  return (data as Report) ?? null;
}

export async function getReportSources(id: string): Promise<ReportSource[]> {
  const db = supabaseRead();
  if (!db) return [];
  const { data, error } = await db
    .from("report_items")
    .select(
      "raw_item_id, similarity, raw_items(author, raw_url, captured_at, source_id, sources(name, type))",
    )
    .eq("report_id", id)
    .order("similarity", { ascending: false });

  if (error) {
    console.error("[queries.getReportSources]", error.message);
    return [];
  }

  // PostgREST returns nested relations; normalize the shape.
  return ((data as unknown as RawJoin[]) ?? []).map((row) => ({
    raw_item_id: row.raw_item_id,
    similarity: row.similarity,
    author: row.raw_items?.author ?? null,
    raw_url: row.raw_items?.raw_url ?? null,
    captured_at: row.raw_items?.captured_at ?? null,
    source_name: row.raw_items?.sources?.name ?? null,
    source_type: (row.raw_items?.sources?.type ?? "other") as SourceType,
  }));
}

interface RawJoin {
  raw_item_id: string;
  similarity: number | null;
  raw_items: {
    author: string | null;
    raw_url: string | null;
    captured_at: string | null;
    source_id: string | null;
    sources: { name: string | null; type: SourceType | null } | null;
  } | null;
}

export async function getReportComments(id: string, limit = 20): Promise<Verification[]> {
  const db = supabaseRead();
  if (!db) return [];
  const { data, error } = await db
    .from("verifications")
    .select("id, report_id, vote, comment, evidence_url, created_at, voter_hash")
    .eq("report_id", id)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[queries.getReportComments]", error.message);
    return [];
  }
  return (data as Verification[]) ?? [];
}

export async function getMyVote(reportId: string, voterHash: string | null): Promise<VoteType | null> {
  if (!voterHash) return null;
  const db = supabaseRead();
  if (!db) return null;
  const { data } = await db
    .from("verifications")
    .select("vote")
    .eq("report_id", reportId)
    .eq("voter_hash", voterHash)
    .maybeSingle();
  return (data?.vote as VoteType) ?? null;
}

export async function getStates(): Promise<string[]> {
  const db = supabaseRead();
  if (!db) return [];
  const { data } = await db.from("reports").select("state").not("state", "is", null).limit(1000);
  const set = new Set<string>();
  for (const row of (data as { state: string }[]) ?? []) set.add(row.state);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export interface Stats {
  reports: number;
  verified: number;
  sources: number;
  verifications: number;
}

export async function getStats(): Promise<Stats> {
  const db = supabaseRead();
  if (!db) return { reports: 0, verified: 0, sources: 0, verifications: 0 };

  const [reports, verified, sources, verifications] = await Promise.all([
    db.from("reports").select("*", { count: "exact", head: true }),
    db.from("reports").select("*", { count: "exact", head: true }).eq("status", "verified"),
    db.from("sources").select("*", { count: "exact", head: true }),
    db.from("verifications").select("*", { count: "exact", head: true }),
  ]);

  return {
    reports: reports.count ?? 0,
    verified: verified.count ?? 0,
    sources: sources.count ?? 0,
    verifications: verifications.count ?? 0,
  };
}
