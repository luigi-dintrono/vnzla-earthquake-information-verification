import { deburr } from "@/lib/text";

/**
 * Relevance gate — "earthquake & emergencies only".
 *
 * A crawled item is kept only if it shows a seismic signal OR a concrete
 * emergency/disaster-impact signal. Everything else (politics, economy, sports,
 * entertainment, and affiliate/SEO spam like betting posts) is dropped before
 * it's ever stored. Tune the lists below as needed.
 */

// Seismic / earthquake vocabulary (strong signal).
const SEISMIC = [
  "sismo",
  "sismic",
  "seismo",
  "terremoto",
  "temblor",
  "replica",
  "magnitud",
  "epicentro",
  "telurico",
  "sacudida",
  "richter",
  "funvisis",
  "tsunami",
  "maremoto",
  "falla geologic",
  "placa tectonic",
  "movimiento telurico",
  "intensidad sismica",
  "enjambre sismico",
];

// Concrete emergency / disaster-impact vocabulary (kept tight to avoid letting
// in generic "emergencia económica"-style political/economic news).
const EMERGENCY = [
  "derrumbe",
  "derrumb",
  "colaps",
  "desplom",
  "escombros",
  "grieta",
  "agrietad",
  "cuartead",
  "damnificad",
  "evacuac",
  "evacuad",
  "rescate",
  "rescatist",
  "proteccion civil",
  "defensa civil",
  "bomberos",
  "refugio",
  "albergue",
  "sepultad",
  "atrapad",
  "deslave",
  "deslizamiento de tierra",
  "alud",
  "inundac",
  "socorro",
  "cruz roja",
  "zona de desastre",
  "estado de emergencia",
  "alerta roja",
  "primeros auxilios",
];

// Hard spam / off-topic blocklist — always drop, even if a topic word appears.
const SPAM = [
  "apuesta",
  "casino",
  "tragamonedas",
  "ruleta",
  "poker",
  "bet365",
  "1xbet",
  "betting",
  "bono de bienvenida",
  "ganancias al instante",
  "retirar ganancias",
  "apuestas deportivas",
  "cuota de apuesta",
  "criptomoneda",
  "bitcoin",
  "forex",
  "gana dinero",
  "dinero facil",
  "horoscopo",
  "loteria",
];

/** True if the text is about an earthquake or an emergency/its impact. */
export function isRelevant(text: string | null | undefined): boolean {
  const t = deburr((text ?? "").toLowerCase());
  if (!t.trim()) return false;
  if (SPAM.some((w) => t.includes(w))) return false;
  return SEISMIC.some((w) => t.includes(w)) || EMERGENCY.some((w) => t.includes(w));
}
