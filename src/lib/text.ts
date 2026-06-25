/** Remove diacritics: "Cumaná" -> "Cumana". */
export function deburr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Strip URLs and @/# symbols, collapse whitespace. Keeps human-readable text. */
export function stripNoise(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercased, de-accented, alphanumeric-only — for trigram + embedding matching. */
export function normalizeForMatch(s: string): string {
  return deburr(stripNoise(s).toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export function firstSentence(s: string, max = 90): string {
  const clean = stripNoise(s);
  const m = clean.split(/(?<=[.!?])\s|\n/)[0] ?? clean;
  return clip(m, max);
}
