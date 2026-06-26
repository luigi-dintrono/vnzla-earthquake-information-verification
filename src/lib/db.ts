import { Pool, types } from "pg";
import { env, hasDatabase } from "@/lib/env";

// Return timestamps as ISO strings (matches our `string` types) instead of Date
// objects, so values serialize cleanly across the Server→Client boundary.
const toIso = (v: string): string => new Date(v).toISOString();
types.setTypeParser(1184, toIso); // timestamptz
types.setTypeParser(1114, toIso); // timestamp

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL no está configurada. Crea un proyecto en Neon y copia la cadena de conexión (pooled).",
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      // Neon serves over TLS; allow opting out only for a local sslmode=disable DB.
      ssl: env.databaseUrl.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

// T is unconstrained (our domain types are interfaces, which don't satisfy
// pg's QueryResultRow index-signature constraint), so we cast the rows.
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export { hasDatabase };
