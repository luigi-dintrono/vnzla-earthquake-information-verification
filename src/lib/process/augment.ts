import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env, hasAnthropic } from "@/lib/env";
import { CATEGORY_LABELS, type ReportCategory } from "@/lib/types";
import { clip, firstSentence, normalizeForMatch, stripNoise } from "@/lib/text";
import { geocode } from "@/lib/geo/venezuela";

/**
 * "Augmentation" = turn a messy Spanish post into structured fields: a clear
 * title, category, location (grounded to real coordinates), building name,
 * severity, and a canonical_text used for dedup. Uses Claude when configured,
 * otherwise a deterministic Spanish-keyword heuristic so the app still works.
 */
export interface Augmented {
  title: string;
  summary: string;
  category: ReportCategory;
  location_text: string | null;
  municipality: string | null;
  state: string | null;
  building_name: string | null;
  lat: number | null;
  lng: number | null;
  severity: number | null;
  occurred_at: string | null;
  canonical_text: string;
  method: "llm" | "heuristic";
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ReportCategory[];

// --- Heuristic building blocks ---------------------------------------------

const KEYWORDS: Record<ReportCategory, string[]> = {
  casualty: ["herido", "muerto", "fallecid", "victima", "lesionad", "atrapad", "desaparecid", "sepultad"],
  damage: ["derrumbe", "derrumb", "colaps", "grieta", "agrietad", "desplom", "escombros", "danos", "destru", "cuartead"],
  rescue: ["rescate", "rescatist", "bomberos", "brigada", "busqueda", "remocion de escombros"],
  infrastructure: ["puente", "carretera", "autopista", "viaducto", "represa", "dique"],
  utilities: ["apagon", "electricidad", "sin luz", "sin agua", "acueducto", "internet", "telefon", "sin senal"],
  aid: ["ayuda", "donacion", "viveres", "medicina", "alimentos", "recoleccion", "voluntari"],
  shelter: ["refugio", "albergue", "damnificad", "evacuad"],
  transport: ["metro", "aeropuerto", "vuelos", "ferry", "tranque", "cerrada la via"],
  rumor: ["rumor", "cadena", "fake", "es falso", "no confirmado", "desinformacion"],
  official: ["funvisis", "comunicado oficial", "gobernacion", "alcaldia", "ministerio", "magnitud", "epicentro"],
  other: [],
};

// Tie-break priority (most safety-critical first).
const PRIORITY: ReportCategory[] = [
  "casualty", "rescue", "damage", "infrastructure", "utilities",
  "shelter", "transport", "official", "aid", "rumor", "other",
];

function detectCategory(norm: string): ReportCategory {
  let best: ReportCategory = "other";
  let bestScore = 0;
  for (const cat of PRIORITY) {
    const score = KEYWORDS[cat].reduce((n, kw) => n + (norm.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

function detectSeverity(norm: string): number | null {
  const strong = /(muerto|fallecid|colaps|derrumb|sepultad|atrapad)/.test(norm);
  const catastrophic = /(total|multiples|varios muertos|decenas|numerosos)/.test(norm);
  const medium = /(herido|grieta|dano|agrietad|evacuad|desplom)/.test(norm);
  if (strong && catastrophic) return 5;
  if (strong) return 4;
  if (medium) return 3;
  return null;
}

const BUILDING_RE =
  /\b(edificio|edif\.?|torre|residencias?|conjunto residencial|urbanizaci[oó]n|hospital|cl[ií]nica|ambulatorio|colegio|liceo|escuela|universidad|centro comercial|iglesia|catedral|mercado|terminal|puente|viaducto|estadio)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'’-]*(?:\s+(?:de|del|la|las|los|y|el)\s+|\s+)?[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ.'’-]*(?:\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ.'’-]*)?)/;

function detectBuilding(originalText: string): string | null {
  const m = originalText.match(BUILDING_RE);
  return m ? clip(m[0].trim(), 70) : null;
}

function composeLocation(
  building: string | null,
  municipality: string | null,
  state: string | null,
): string | null {
  const parts = [building, municipality, state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// --- Shared finalize: ground location, compose canonical text --------------

function finalize(
  partial: {
    title?: string | null;
    summary?: string | null;
    category?: string | null;
    location_text?: string | null;
    municipality?: string | null;
    state?: string | null;
    building_name?: string | null;
    severity?: number | null;
    occurred_at?: string | null;
  },
  raw: string,
  capturedAt: string | null,
  method: "llm" | "heuristic",
): Augmented {
  const norm = normalizeForMatch(raw);

  const category: ReportCategory =
    partial.category && CATEGORIES.includes(partial.category as ReportCategory)
      ? (partial.category as ReportCategory)
      : detectCategory(norm);

  // Coordinates only come from our gazetteer (never trust LLM lat/lng).
  const place = geocode(raw, partial.municipality, partial.state);
  const municipality = place?.municipality ?? partial.municipality ?? null;
  const state = place?.state ?? partial.state ?? null;
  const lat = place?.lat ?? null;
  const lng = place?.lng ?? null;

  const building = partial.building_name?.trim() || detectBuilding(raw);

  let title = (partial.title?.trim() || firstSentence(raw, 90)).trim();
  if (title.length < 12) {
    const where = municipality || state;
    title = `${CATEGORY_LABELS[category]}${where ? ` en ${where}` : ""}`;
  }
  title = capitalize(clip(title, 110));

  const summary = (partial.summary?.trim() || clip(stripNoise(raw), 240)).trim();

  const severity =
    typeof partial.severity === "number"
      ? Math.max(1, Math.min(5, Math.round(partial.severity)))
      : detectSeverity(norm);

  const location_text =
    partial.location_text?.trim() || composeLocation(building, municipality, state);

  // canonical_text bakes location in so dedup doesn't merge the same kind of
  // event across different cities.
  const canonical_text = [state, municipality, building, norm]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  return {
    title,
    summary,
    category,
    location_text,
    municipality,
    state,
    building_name: building,
    lat,
    lng,
    severity,
    occurred_at: partial.occurred_at?.trim() || capturedAt,
    canonical_text: canonical_text || norm || stripNoise(raw).toLowerCase(),
    method,
  };
}

// --- LLM path ---------------------------------------------------------------

const LlmSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional().default(""),
  category: z.string(),
  location_text: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  building_name: z.string().nullable().optional(),
  severity: z.number().nullable().optional(),
  occurred_at: z.string().nullable().optional(),
});

let anthropic: Anthropic | null = null;

async function augmentWithLlm(raw: string, capturedAt: string | null): Promise<Augmented | null> {
  if (!anthropic) anthropic = new Anthropic({ apiKey: env.anthropicKey });

  try {
    const msg = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system:
        "Eres un analista de información de emergencias para Venezuela tras un terremoto. " +
        "Extrae datos estructurados de publicaciones (X, noticias, reportes ciudadanos), en español. " +
        "Sé fiel al texto: no inventes ubicaciones, cifras ni edificios que no se mencionen. " +
        "Resume de forma neutral y verificable. Si un dato no está, devuélvelo como null.",
      tools: [
        {
          name: "registrar_reporte",
          description: "Registra los campos estructurados extraídos del reporte.",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titular claro y neutral (máx ~100 caracteres)." },
              summary: { type: "string", description: "Resumen de 1-2 frases, neutral." },
              category: { type: "string", enum: CATEGORIES, description: "Categoría del reporte." },
              location_text: { type: ["string", "null"], description: "Ubicación legible (zona, dirección)." },
              municipality: { type: ["string", "null"], description: "Ciudad o municipio." },
              state: { type: ["string", "null"], description: "Estado de Venezuela." },
              building_name: { type: ["string", "null"], description: "Nombre del edificio/estructura si se menciona." },
              severity: { type: ["integer", "null"], description: "Gravedad 1 (leve) a 5 (catastrófico), o null." },
              occurred_at: { type: ["string", "null"], description: "Fecha/hora ISO 8601 del hecho si se infiere, o null." },
            },
            required: ["title", "category"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "registrar_reporte" },
      messages: [
        {
          role: "user",
          content:
            `Fecha de captura del mensaje: ${capturedAt ?? "desconocida"}.\n\n` +
            `Publicación:\n"""${raw.slice(0, 4000)}"""`,
        },
      ],
    });

    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    const parsed = LlmSchema.safeParse(block.input);
    if (!parsed.success) return null;
    return finalize(parsed.data, raw, capturedAt, "llm");
  } catch (e) {
    console.warn("[augment] LLM failed, using heuristic:", (e as Error).message);
    return null;
  }
}

// --- Public API -------------------------------------------------------------

export async function augment(raw: string, capturedAt: string | null = null): Promise<Augmented> {
  if (hasAnthropic()) {
    const llm = await augmentWithLlm(raw, capturedAt);
    if (llm) return llm;
  }
  return finalize({}, raw, capturedAt, "heuristic");
}
