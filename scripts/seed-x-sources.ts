import "./load-env";
import { hasDatabase, env } from "@/lib/env";
import { getPool, query, queryOne } from "@/lib/db";
import { CURATED_X_ACCOUNTS } from "@/lib/ingest/x-accounts";

/**
 * Idempotently upserts the curated top-verifiable X accounts as sources, so the
 * X connector can crawl them for base information. Safe to re-run: matches on
 * (type='x', handle) and updates name/trust_weight without duplicating.
 *
 *   npm run seed:x
 *
 * Fetching also needs X_CONNECTOR_ENABLED=true and a X_FEED_GATEWAY (or a
 * per-source config.feedUrl). Without those the rows are inserted but inert.
 */
async function main() {
  if (!hasDatabase()) {
    console.error(
      "✗ DATABASE_URL no está configurada. Define DATABASE_URL (Neon, pooled) en .env.local.",
    );
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;

  for (const acc of CURATED_X_ACCOUNTS) {
    const handle = acc.handle.trim();
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM sources WHERE type = 'x' AND lower(handle) = lower($1) LIMIT 1",
      [handle],
    );

    if (existing) {
      await query(
        "UPDATE sources SET name = $1, trust_weight = $2, active = true WHERE id = $3",
        [acc.name, acc.trust_weight, existing.id],
      );
      updated++;
    } else {
      await query(
        "INSERT INTO sources (type, name, handle, trust_weight) VALUES ('x', $1, $2, $3)",
        [acc.name, handle, acc.trust_weight],
      );
      inserted++;
    }
  }

  console.log(
    `Listo. ${CURATED_X_ACCOUNTS.length} cuentas curadas → ${inserted} nuevas, ${updated} actualizadas.`,
  );
  if (!env.xConnectorEnabled) {
    console.log(
      "Nota: el conector X está deshabilitado. Para crawlear, define X_CONNECTOR_ENABLED=true y X_FEED_GATEWAY.",
    );
  } else if (!env.xFeedGateway) {
    console.log(
      "Nota: falta X_FEED_GATEWAY. Define una pasarela (p. ej. una base Nitter) o config.feedUrl por fuente.",
    );
  }

  await getPool().end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("seed:x falló:", e);
  process.exit(1);
});
