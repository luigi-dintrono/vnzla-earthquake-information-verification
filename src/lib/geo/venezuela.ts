import { deburr } from "@/lib/text";

/**
 * Lightweight Venezuela gazetteer to ground locations + coordinates without an
 * external geocoding API. Covers the 24 states and major cities, weighted toward
 * the seismically active east (Sucre / Nueva Esparta / Monagas), where
 * Venezuela's strongest recent quakes have struck.
 */
export interface Place {
  municipality: string | null;
  state: string;
  lat: number;
  lng: number;
}

interface City {
  name: string;
  aliases?: string[];
  state: string;
  lat: number;
  lng: number;
}

const CITIES: City[] = [
  // Sucre (high seismicity)
  { name: "Cumaná", state: "Sucre", lat: 10.4554, lng: -64.1767 },
  { name: "Carúpano", state: "Sucre", lat: 10.6678, lng: -63.2581 },
  { name: "Cariaco", state: "Sucre", lat: 10.5003, lng: -63.5517 },
  { name: "Yaguaraparo", state: "Sucre", lat: 10.5697, lng: -62.8336 },
  { name: "Güiria", state: "Sucre", lat: 10.5717, lng: -62.2967 },
  { name: "Río Caribe", state: "Sucre", lat: 10.6936, lng: -63.1083 },
  // Nueva Esparta
  { name: "Porlamar", state: "Nueva Esparta", lat: 10.9577, lng: -63.8486 },
  { name: "La Asunción", state: "Nueva Esparta", lat: 11.0333, lng: -63.8628 },
  { name: "Pampatar", state: "Nueva Esparta", lat: 10.9986, lng: -63.7964 },
  // Monagas
  { name: "Maturín", state: "Monagas", lat: 9.7457, lng: -63.1832 },
  // Anzoátegui
  { name: "Barcelona", state: "Anzoátegui", lat: 10.1333, lng: -64.6833 },
  { name: "Puerto La Cruz", state: "Anzoátegui", lat: 10.2138, lng: -64.6164 },
  { name: "El Tigre", state: "Anzoátegui", lat: 8.8889, lng: -64.2536 },
  // Distrito Capital / Gran Caracas
  { name: "Caracas", aliases: ["ccs"], state: "Distrito Capital", lat: 10.4806, lng: -66.9036 },
  // Miranda
  { name: "Los Teques", state: "Miranda", lat: 10.344, lng: -67.042 },
  { name: "Guarenas", state: "Miranda", lat: 10.4717, lng: -66.6106 },
  { name: "Guatire", state: "Miranda", lat: 10.4747, lng: -66.5408 },
  // La Guaira
  { name: "La Guaira", aliases: ["vargas"], state: "La Guaira", lat: 10.6017, lng: -66.9319 },
  // Carabobo
  { name: "Valencia", state: "Carabobo", lat: 10.1621, lng: -68.0078 },
  // Aragua
  { name: "Maracay", state: "Aragua", lat: 10.2469, lng: -67.5958 },
  // Lara
  { name: "Barquisimeto", state: "Lara", lat: 10.0647, lng: -69.3467 },
  // Zulia
  { name: "Maracaibo", state: "Zulia", lat: 10.6545, lng: -71.6437 },
  // Táchira
  { name: "San Cristóbal", state: "Táchira", lat: 7.7669, lng: -72.225 },
  // Mérida
  { name: "Mérida", state: "Mérida", lat: 8.5897, lng: -71.144 },
  // Trujillo
  { name: "Trujillo", state: "Trujillo", lat: 9.3667, lng: -70.4333 },
  // Falcón
  { name: "Coro", state: "Falcón", lat: 11.4045, lng: -69.6734 },
  { name: "Punto Fijo", state: "Falcón", lat: 11.7158, lng: -70.2017 },
  // Bolívar
  { name: "Ciudad Bolívar", state: "Bolívar", lat: 8.1222, lng: -63.5497 },
  { name: "Ciudad Guayana", aliases: ["puerto ordaz"], state: "Bolívar", lat: 8.3533, lng: -62.6528 },
  // Others (state capitals)
  { name: "Tucupita", state: "Delta Amacuro", lat: 9.0606, lng: -62.0444 },
  { name: "Guanare", state: "Portuguesa", lat: 9.0419, lng: -69.7419 },
  { name: "Barinas", state: "Barinas", lat: 8.6226, lng: -70.2076 },
  { name: "San Carlos", state: "Cojedes", lat: 9.6611, lng: -68.5867 },
  { name: "San Juan de los Morros", state: "Guárico", lat: 9.9075, lng: -67.3544 },
  { name: "San Felipe", state: "Yaracuy", lat: 10.3403, lng: -68.7425 },
  { name: "San Fernando de Apure", state: "Apure", lat: 7.8939, lng: -67.4736 },
  { name: "Puerto Ayacucho", state: "Amazonas", lat: 5.6639, lng: -67.6236 },
];

// State centroids, for when a state is named but no city is.
const STATES: Record<string, { lat: number; lng: number }> = {
  Sucre: { lat: 10.45, lng: -63.6 },
  "Nueva Esparta": { lat: 11.0, lng: -63.9 },
  Monagas: { lat: 9.4, lng: -63.0 },
  Anzoátegui: { lat: 9.3, lng: -64.3 },
  "Distrito Capital": { lat: 10.49, lng: -66.88 },
  Miranda: { lat: 10.2, lng: -66.4 },
  "La Guaira": { lat: 10.6, lng: -66.9 },
  Carabobo: { lat: 10.18, lng: -68.0 },
  Aragua: { lat: 10.2, lng: -67.3 },
  Lara: { lat: 10.0, lng: -69.8 },
  Zulia: { lat: 9.9, lng: -71.9 },
  Táchira: { lat: 7.9, lng: -72.0 },
  Mérida: { lat: 8.5, lng: -71.1 },
  Trujillo: { lat: 9.4, lng: -70.4 },
  Falcón: { lat: 11.2, lng: -69.8 },
  Bolívar: { lat: 6.5, lng: -63.5 },
  "Delta Amacuro": { lat: 8.8, lng: -61.0 },
  Portuguesa: { lat: 9.2, lng: -69.7 },
  Barinas: { lat: 8.3, lng: -70.0 },
  Cojedes: { lat: 9.4, lng: -68.4 },
  Guárico: { lat: 9.0, lng: -66.6 },
  Yaracuy: { lat: 10.3, lng: -68.8 },
  Apure: { lat: 7.1, lng: -68.5 },
  Amazonas: { lat: 4.0, lng: -65.5 },
};

const norm = (s: string) => deburr(s).toLowerCase();
// Longer names first so "Puerto La Cruz" wins over "Cruz", "San Cristóbal" over "San".
const CITY_INDEX = CITIES.map((c) => ({
  city: c,
  keys: [c.name, ...(c.aliases ?? [])].map(norm),
})).sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)));

const STATE_INDEX = Object.keys(STATES)
  .map((name) => ({ name, key: norm(name) }))
  .sort((a, b) => b.key.length - a.key.length);

function containsWord(haystack: string, needle: string): boolean {
  // word-ish boundary using spaces; haystack is pre-padded
  return haystack.includes(` ${needle} `);
}

/**
 * Best-effort geocode from free text, optionally biased by hints the LLM
 * extracted. Returns null if nothing recognizable is found.
 */
export function geocode(
  text: string,
  municipalityHint?: string | null,
  stateHint?: string | null,
): Place | null {
  const hay = ` ${norm(`${municipalityHint ?? ""} ${stateHint ?? ""} ${text}`)} `;

  for (const { city, keys } of CITY_INDEX) {
    if (keys.some((k) => containsWord(hay, k))) {
      return { municipality: city.name, state: city.state, lat: city.lat, lng: city.lng };
    }
  }
  for (const { name, key } of STATE_INDEX) {
    if (containsWord(hay, key)) {
      const c = STATES[name];
      return { municipality: null, state: name, lat: c.lat, lng: c.lng };
    }
  }
  return null;
}
