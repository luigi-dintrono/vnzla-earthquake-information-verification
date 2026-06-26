/**
 * Curated official-institution X accounts to seed as "base information"
 * sources. These are the authoritative emergency/seismology accounts that have
 * NO public RSS feed, so X is the only way to pull them. Newsrooms live in
 * `media-feeds.ts` instead (they have real RSS — no gateway needed).
 *
 * trust_weight is a 0–1 confidence prior (1 = máxima confianza, fuente
 * oficial). It only orders/labels sources today; the crowd still verifies
 * everything.
 *
 * Fetching: the X connector resolves each handle to RSS via X_FEED_GATEWAY
 * (e.g. a Nitter base). Seed with `npm run seed:x`.
 */
export interface CuratedXAccount {
  handle: string;
  name: string;
  trust_weight: number;
}

export const CURATED_X_ACCOUNTS: CuratedXAccount[] = [
  { handle: "@ProteccionCivil", name: "Protección Civil Venezuela", trust_weight: 1.0 },
  { handle: "@inameh", name: "INAMEH (Meteorología)", trust_weight: 0.9 },
  // Removed @FUNVISIS — official seismic agency but dormant since Jan 2024 (no
  // data). Re-add here if it revives or a successor handle appears.
];
