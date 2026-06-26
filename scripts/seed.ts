import "./load-env";
import { hasAnthropic, hasDatabase, hasOpenAI } from "@/lib/env";
import { getPool, query, queryOne } from "@/lib/db";
import { processOne } from "@/lib/process";
import type { RawItem, SourceType, VoteType } from "@/lib/types";

/**
 * Seeds a realistic, demoable dataset: several earthquake-aftermath events, each
 * reported by multiple sources with different wording (to exercise dedup), plus
 * simulated crowd verification (to populate counts + auto-status).
 *
 * Works with zero API keys (heuristic augmentation + trigram dedup); richer with
 * ANTHROPIC_API_KEY (better extraction) and OPENAI_API_KEY (semantic dedup).
 *
 *   npm run seed
 */

type SourceKey = "pitazo" | "cocuyo" | "funvisis" | "ciudadano" | "sismosve";

const SOURCES: Record<SourceKey, { type: SourceType; name: string; url: string | null; handle?: string }> = {
  pitazo: { type: "news", name: "El Pitazo", url: "https://elpitazo.net/feed/" },
  cocuyo: { type: "news", name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/" },
  funvisis: { type: "rss", name: "FUNVISIS (Sismológico)", url: null },
  ciudadano: { type: "manual", name: "Reporte ciudadano", url: null },
  sismosve: { type: "x", name: "@SismosVe", url: null, handle: "@SismosVe" },
};

interface Variant {
  source: SourceKey;
  author: string;
  text: string;
  url?: string;
}

interface EventSeed {
  key: string;
  minutesAgo: number;
  variants: Variant[];
  votes?: Partial<Record<VoteType, number>>;
  comments?: Partial<Record<VoteType, { text: string; evidence?: string }>>;
}

const EVENTS: EventSeed[] = [
  {
    key: "miramar",
    minutesAgo: 35,
    variants: [
      {
        source: "ciudadano",
        author: "Vecino de Cumaná",
        text: "Se reportan grietas graves en el Edificio Residencias Miramar en Cumaná, estado Sucre. Los vecinos evacuaron por miedo a un derrumbe tras el sismo.",
      },
      {
        source: "pitazo",
        author: "El Pitazo",
        text: "Reportan daños estructurales y grietas en las Residencias Miramar de Cumaná, Sucre. Bomberos evalúan el riesgo de colapso; varias familias fueron evacuadas.",
        url: "https://elpitazo.net/oriente/residencias-miramar-cumana",
      },
      {
        source: "cocuyo",
        author: "Efecto Cocuyo",
        text: "Habitantes del Edificio Residencias Miramar en Cumaná denuncian agrietamiento en las columnas tras el terremoto en Sucre. Piden inspección urgente.",
        url: "https://efectococuyo.com/sucre/miramar",
      },
    ],
    votes: { confirm: 8, dispute: 1, unsure: 1 },
    comments: {
      confirm: { text: "Vivo al lado, las grietas son reales y se ven desde la calle.", evidence: "https://example.org/foto-miramar.jpg" },
    },
  },
  {
    key: "sismo64",
    minutesAgo: 60,
    variants: [
      {
        source: "funvisis",
        author: "FUNVISIS",
        text: "FUNVISIS reporta sismo de magnitud 6.4 con epicentro en el Golfo de Cariaco, estado Sucre, a 10 km de profundidad. Se sintió en todo el oriente del país.",
      },
      {
        source: "pitazo",
        author: "El Pitazo",
        text: "Un fuerte sismo de magnitud 6.4 sacudió el oriente de Venezuela con epicentro en el Golfo de Cariaco, según FUNVISIS.",
        url: "https://elpitazo.net/oriente/sismo-cariaco",
      },
    ],
    votes: { confirm: 12 },
  },
  {
    key: "hospital",
    minutesAgo: 50,
    variants: [
      {
        source: "ciudadano",
        author: "Familiar de paciente",
        text: "Evacuaron a pacientes del Hospital Universitario de Cumaná por daños en una pared tras el temblor.",
      },
      {
        source: "cocuyo",
        author: "Efecto Cocuyo",
        text: "El Hospital Universitario Antonio Patricio de Alcalá en Cumaná evacuó áreas por fisuras tras el sismo en Sucre.",
        url: "https://efectococuyo.com/sucre/hospital-cumana",
      },
    ],
    votes: { confirm: 3, unsure: 1 },
  },
  {
    key: "apagon",
    minutesAgo: 80,
    variants: [
      {
        source: "ciudadano",
        author: "Usuario",
        text: "Carúpano completamente sin luz después del terremoto. No hay electricidad en varios sectores de Sucre.",
      },
      {
        source: "sismosve",
        author: "@SismosVe",
        text: "Reportan apagón general en Carúpano, estado Sucre, tras el sismo. Usuarios sin servicio eléctrico desde hace horas.",
      },
    ],
    votes: { confirm: 5, dispute: 1 },
  },
  {
    key: "puente",
    minutesAgo: 95,
    variants: [
      {
        source: "pitazo",
        author: "El Pitazo",
        text: "Cierran el puente sobre el río Manzanares en Cumaná por grietas detectadas tras el sismo; recomiendan usar vías alternas.",
        url: "https://elpitazo.net/oriente/puente-manzanares",
      },
    ],
    votes: { confirm: 2, unsure: 2 },
  },
  {
    key: "tsunami",
    minutesAgo: 70,
    variants: [
      {
        source: "sismosve",
        author: "@SismosVe",
        text: "URGENTE: dicen que viene un tsunami a las costas de Sucre por el terremoto. ¡Compartan!",
      },
    ],
    votes: { confirm: 1, dispute: 9 },
    comments: {
      dispute: { text: "Protección Civil desmintió la alerta de tsunami. Por favor no compartan cadenas falsas." },
    },
  },
  {
    key: "refugio",
    minutesAgo: 110,
    variants: [
      {
        source: "ciudadano",
        author: "Voluntaria",
        text: "Habilitaron un refugio en la Escuela Básica de Cariaco para damnificados. Piden colchonetas, agua potable y medicinas.",
      },
      {
        source: "cocuyo",
        author: "Efecto Cocuyo",
        text: "En Cariaco, Sucre, una escuela funciona como albergue para familias afectadas por el terremoto; solicitan donaciones de agua y alimentos.",
        url: "https://efectococuyo.com/sucre/refugio-cariaco",
      },
    ],
    votes: { confirm: 4 },
  },
  {
    key: "porlamar",
    minutesAgo: 120,
    variants: [
      {
        source: "pitazo",
        author: "El Pitazo",
        text: "Centros de salud en Porlamar, Nueva Esparta, atienden a varias personas con heridas leves tras el sismo sentido en la isla de Margarita.",
        url: "https://elpitazo.net/insular/porlamar-heridos",
      },
    ],
    votes: { confirm: 2, unsure: 1 },
  },
];

async function clean() {
  // Only wipe DEMO data — never touch real crawled reports/items or shared sources.
  await query("DELETE FROM verifications WHERE report_id IN (SELECT id FROM reports WHERE is_demo)");
  await query("DELETE FROM report_items WHERE report_id IN (SELECT id FROM reports WHERE is_demo)");
  await query("DELETE FROM raw_items WHERE is_demo");
  await query("DELETE FROM reports WHERE is_demo");
}

async function insertSources(): Promise<Record<SourceKey, string>> {
  const map = {} as Record<SourceKey, string>;
  for (const key of Object.keys(SOURCES) as SourceKey[]) {
    const s = SOURCES[key];
    // Idempotent: reuse an existing source of the same type+name (sources are
    // shared with the real crawler and managed by seed:x / seed:media).
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM sources WHERE type = $1 AND name = $2 LIMIT 1",
      [s.type, s.name],
    );
    const row =
      existing ??
      (await queryOne<{ id: string }>(
        "INSERT INTO sources (type, name, url, handle) VALUES ($1, $2, $3, $4) RETURNING id",
        [s.type, s.name, s.url, s.handle ?? null],
      ));
    map[key] = row!.id;
  }
  return map;
}

async function applyVotes(reportId: string, ev: EventSeed) {
  for (const vote of ["confirm", "dispute", "unsure"] as VoteType[]) {
    const n = ev.votes?.[vote] ?? 0;
    const c = ev.comments?.[vote];
    for (let i = 0; i < n; i++) {
      await query(
        "INSERT INTO verifications (report_id, voter_hash, vote, comment, evidence_url) VALUES ($1, $2, $3, $4, $5)",
        [
          reportId,
          `seed-${ev.key}-${vote}-${i}`,
          vote,
          i === 0 && c ? c.text : null,
          i === 0 && c?.evidence ? c.evidence : null,
        ],
      );
    }
  }
}

async function main() {
  if (!hasDatabase()) {
    console.error(
      "✗ DATABASE_URL no está configurada.\n" +
        "  Define DATABASE_URL (Neon, pooled) en .env.local y ejecuta `npm run db:migrate` antes de sembrar.",
    );
    process.exit(1);
  }

  console.log(
    `Capacidades → augmentación: ${hasAnthropic() ? "Claude" : "heurística"}, ` +
      `dedup: ${hasOpenAI() ? "embeddings (pgvector)" : "trigram (pg_trgm)"}`,
  );

  console.log("Limpiando datos previos…");
  await clean();

  console.log("Insertando fuentes…");
  const sources = await insertSources();

  let created = 0;
  let matched = 0;

  for (const ev of EVENTS) {
    let firstReportId: string | null = null;

    for (let i = 0; i < ev.variants.length; i++) {
      const v = ev.variants[i];
      const capturedAt = new Date(Date.now() - ev.minutesAgo * 60_000 + i * 90_000).toISOString();

      const item = await queryOne<RawItem>(
        `INSERT INTO raw_items (source_id, external_id, author, raw_text, raw_url, lang, captured_at, status, is_demo)
         VALUES ($1, $2, $3, $4, $5, 'es', $6, 'pending', true)
         RETURNING *`,
        [sources[v.source], `seed-${ev.key}-${i}`, v.author, v.text, v.url ?? null, capturedAt],
      );

      const outcome = await processOne(item!);
      if (outcome.matched) matched++;
      else created++;
      if (!firstReportId) firstReportId = outcome.reportId;
    }

    if (firstReportId) await applyVotes(firstReportId, ev);
    console.log(`  ✓ evento "${ev.key}" (${ev.variants.length} fuentes)`);
  }

  const row = await queryOne<{ count: number }>("SELECT count(*)::int AS count FROM reports");
  console.log(
    `\nListo. ${EVENTS.length} eventos sembrados → ${row?.count ?? 0} reportes ` +
      `(${created} nuevos, ${matched} agrupados por similitud).`,
  );
  console.log("Abre http://localhost:3000 después de `npm run dev`.");

  await getPool().end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("seed falló:", e);
  process.exit(1);
});
