import "./load-env";
import { hasDatabase } from "@/lib/env";
import { getPool, query, queryOne } from "@/lib/db";
import { CURATED_MEDIA_FEEDS } from "@/lib/ingest/media-feeds";

/**
 * Idempotently upserts the curated Venezuelan news RSS feeds as 'news' sources.
 * Safe to re-run: matches on URL and updates name/trust_weight without
 * duplicating. These crawl immediately — no gateway required.
 *
 *   npm run seed:media
 */
async function main() {
  if (!hasDatabase()) {
    console.error("✗ DATABASE_URL no está configurada (Neon, pooled) en .env.local.");
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;

  for (const feed of CURATED_MEDIA_FEEDS) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM sources WHERE lower(url) = lower($1) LIMIT 1",
      [feed.url],
    );

    if (existing) {
      await query(
        "UPDATE sources SET name = $1, trust_weight = $2, type = 'news', active = true WHERE id = $3",
        [feed.name, feed.trust_weight, existing.id],
      );
      updated++;
    } else {
      await query(
        "INSERT INTO sources (type, name, url, trust_weight) VALUES ('news', $1, $2, $3)",
        [feed.name, feed.url, feed.trust_weight],
      );
      inserted++;
    }
  }

  console.log(
    `Listo. ${CURATED_MEDIA_FEEDS.length} feeds de medios → ${inserted} nuevos, ${updated} actualizados.`,
  );

  await getPool().end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("seed:media falló:", e);
  process.exit(1);
});
