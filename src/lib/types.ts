/**
 * Domain types — mirror the Postgres schema in db/schema.sql.
 * Spanish display labels live alongside each enum (the UI is Spanish-first).
 */

export type SourceType = "x" | "rss" | "news" | "manual" | "other";

export type ItemStatus = "pending" | "processed" | "rejected" | "duplicate";

export type ReportStatus =
  | "unverified"
  | "verifying"
  | "verified"
  | "disputed"
  | "false";

export type ReportCategory =
  | "damage"
  | "casualty"
  | "rescue"
  | "infrastructure"
  | "utilities"
  | "aid"
  | "shelter"
  | "transport"
  | "rumor"
  | "official"
  | "other";

export type VoteType = "confirm" | "dispute" | "unsure";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  damage: "Daños / colapso",
  casualty: "Víctimas / heridos",
  rescue: "Rescate",
  infrastructure: "Infraestructura",
  utilities: "Servicios (luz/agua)",
  aid: "Ayuda / donaciones",
  shelter: "Refugios",
  transport: "Transporte / vías",
  rumor: "Rumor por verificar",
  official: "Información oficial",
  other: "Otro",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  unverified: "Sin verificar",
  verifying: "En verificación",
  verified: "Verificado por la comunidad",
  disputed: "En disputa",
  false: "Marcado como falso",
};

export const VOTE_LABELS: Record<VoteType, string> = {
  confirm: "Lo confirmo",
  dispute: "Lo dudo / es falso",
  unsure: "No estoy seguro",
};

export interface Source {
  id: string;
  type: SourceType;
  name: string;
  url: string | null;
  handle: string | null;
  trust_weight: number;
  active: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface RawItem {
  id: string;
  source_id: string | null;
  external_id: string | null;
  author: string | null;
  raw_text: string;
  raw_url: string | null;
  lang: string | null;
  media: MediaItem[];
  captured_at: string | null;
  submitted_by: string | null;
  status: ItemStatus;
  report_id: string | null;
  similarity: number | null;
  created_at: string;
}

export interface MediaItem {
  type: "image" | "video" | "link";
  url: string;
  thumbnail?: string;
}

export interface Report {
  id: string;
  title: string;
  summary: string | null;
  canonical_text: string;
  category: ReportCategory;
  status: ReportStatus;
  location_text: string | null;
  municipality: string | null;
  state: string | null;
  building_name: string | null;
  lat: number | null;
  lng: number | null;
  severity: number | null;
  occurred_at: string | null;
  report_count: number;
  source_count: number;
  confirm_count: number;
  dispute_count: number;
  unsure_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  report_id: string;
  voter_hash: string;
  vote: VoteType;
  comment: string | null;
  evidence_url: string | null;
  created_at: string;
}

/** A raw source item joined onto a report, for the "reported by N sources" list. */
export interface ReportSource {
  raw_item_id: string;
  source_name: string | null;
  source_type: SourceType;
  author: string | null;
  raw_url: string | null;
  similarity: number | null;
  captured_at: string | null;
}
