/**
 * Curated Venezuelan news RSS feeds to crawl for base information. Unlike X
 * accounts, these need no gateway — the RSS connector reads them directly.
 *
 * Every URL here was probed live and returns a valid RSS/Atom document. Seed
 * them idempotently (deduped by URL) with `npm run seed:media`.
 */
export interface CuratedFeed {
  name: string;
  url: string;
  trust_weight: number;
}

// trust_weight is a 0–1 confidence prior (1 = máxima confianza). Newsrooms sit
// below official institutions (1.0); tabloids sit lowest.
export const CURATED_MEDIA_FEEDS: CuratedFeed[] = [
  // Established independent newsrooms.
  { name: "El Pitazo", url: "https://elpitazo.net/feed/", trust_weight: 0.8 },
  { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/", trust_weight: 0.8 },
  { name: "Runrun.es", url: "https://runrun.es/feed/", trust_weight: 0.7 },
  { name: "Crónica Uno", url: "https://cronica.uno/feed/", trust_weight: 0.7 },
  { name: "TalCual", url: "https://talcualdigital.com/feed/", trust_weight: 0.7 },
  { name: "El Nacional", url: "https://www.elnacional.com/feed/", trust_weight: 0.7 },
  { name: "La Patilla", url: "https://lapatilla.com/feed/", trust_weight: 0.6 },
  // Regional — strong for local damage reports outside Caracas.
  { name: "El Impulso (Lara)", url: "https://www.elimpulso.com/feed/", trust_weight: 0.7 },
  { name: "Descifrado", url: "https://www.descifrado.com/feed/", trust_weight: 0.6 },
  { name: "2001", url: "https://2001online.com/feed/", trust_weight: 0.5 },
];
