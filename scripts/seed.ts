import "./load-env";
import { hasAnthropic, hasOpenAI, hasSupabaseAdmin } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

async function clean(db: ReturnType<typeof supabaseAdmin>) {
  // Order respects FKs (cascades cover the rest).
  for (const table of ["verifications", "report_items", "reports", "raw_items", "sources"]) {
    await db.from(table).delete().gte("created_at", "1900-01-01");
  }
}

async function insertSources(db: ReturnType<typeof supabaseAdmin>): Promise<Record<SourceKey, string>> {
  const rows = (Object.entries(SOURCES) as [SourceKey, (typeof SOURCES)[SourceKey]][]).map(
    ([, s]) => ({ type: s.type, name: s.name, url: s.url, handle: s.handle ?? null }),
  );
  const { data, error } = await db.from("sources").insert(rows).select("id, name");
  if (error) throw error;

  const byName = new Map<string, string>((data ?? []).map((r) => [r.name as string, r.id as string]));
  const map = {} as Record<SourceKey, string>;
  for (const key of Object.keys(SOURCES) as SourceKey[]) {
    map[key] = byName.get(SOURCES[key].name)!;
  }
  return map;
}

async function applyVotes(
  db: ReturnType<typeof supabaseAdmin>,
  reportId: string,
  ev: EventSeed,
) {
  const rows: {
    report_id: string;
    voter_hash: string;
    vote: VoteType;
    comment: string | null;
    evidence_url: string | null;
  }[] = [];

  for (const vote of ["confirm", "dispute", "unsure"] as VoteType[]) {
    const n = ev.votes?.[vote] ?? 0;
    const c = ev.comments?.[vote];
    for (let i = 0; i < n; i++) {
      rows.push({
        report_id: reportId,
        voter_hash: `seed-${ev.key}-${vote}-${i}`,
        vote,
        comment: i === 0 && c ? c.text : null,
        evidence_url: i === 0 && c?.evidence ? c.evidence : null,
      });
    }
  }

  if (rows.length) {
    const { error } = await db.from("verifications").insert(rows);
    if (error) throw error;
  }
}

async function main() {
  if (!hasSupabaseAdmin()) {
    console.error(
      "✗ Supabase admin no está configurado.\n" +
        "  Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local,\n" +
        "  y ejecuta la migración supabase/migrations/0001_init.sql antes de sembrar.",
    );
    process.exit(1);
  }

  console.log(
    `Capacidades → augmentación: ${hasAnthropic() ? "Claude" : "heurística"}, ` +
      `dedup: ${hasOpenAI() ? "embeddings (pgvector)" : "trigram (pg_trgm)"}`,
  );

  const db = supabaseAdmin();

  console.log("Limpiando datos previos…");
  await clean(db);

  console.log("Insertando fuentes…");
  const sources = await insertSources(db);

  let created = 0;
  let matched = 0;

  for (const ev of EVENTS) {
    let firstReportId: string | null = null;

    for (let i = 0; i < ev.variants.length; i++) {
      const v = ev.variants[i];
      const capturedAt = new Date(Date.now() - ev.minutesAgo * 60_000 + i * 90_000).toISOString();

      const { data: item, error } = await db
        .from("raw_items")
        .insert({
          source_id: sources[v.source],
          external_id: `seed-${ev.key}-${i}`,
          author: v.author,
          raw_text: v.text,
          raw_url: v.url ?? null,
          lang: "es",
          captured_at: capturedAt,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;

      const outcome = await processOne(item as RawItem, db);
      if (outcome.matched) matched++;
      else created++;
      if (!firstReportId) firstReportId = outcome.reportId;
    }

    if (firstReportId) await applyVotes(db, firstReportId, ev);
    console.log(`  ✓ evento "${ev.key}" (${ev.variants.length} fuentes)`);
  }

  const { count } = await db.from("reports").select("*", { count: "exact", head: true });
  console.log(
    `\nListo. ${EVENTS.length} eventos sembrados → ${count} reportes ` +
      `(${created} nuevos, ${matched} agrupados por similitud).`,
  );
  console.log("Abre http://localhost:3000 después de `npm run dev`.");
  process.exit(0);
}

main().catch((e) => {
  console.error("seed falló:", e);
  process.exit(1);
});
