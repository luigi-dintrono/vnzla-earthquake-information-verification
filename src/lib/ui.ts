import type { ReportCategory, ReportStatus } from "@/lib/types";

/** Emoji per category — friendly, language-neutral, zero icon-dependency risk. */
export const CATEGORY_EMOJI: Record<ReportCategory, string> = {
  damage: "🏚️",
  casualty: "🩹",
  rescue: "🛟",
  infrastructure: "🌉",
  utilities: "⚡",
  aid: "🤝",
  shelter: "⛺",
  transport: "🚌",
  rumor: "❓",
  official: "📢",
  other: "📌",
};

/** Maps a status to its CSS color-variable stem (see globals.css). */
export const STATUS_VAR: Record<ReportStatus, string> = {
  verified: "verified",
  verifying: "verifying",
  disputed: "disputed",
  false: "falsehood",
  unverified: "unverified",
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Leve",
  2: "Menor",
  3: "Moderado",
  4: "Grave",
  5: "Crítico",
};
