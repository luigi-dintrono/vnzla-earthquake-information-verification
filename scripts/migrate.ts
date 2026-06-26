import "./load-env";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getPool } from "@/lib/db";

/**
 * Applies db/schema.sql to DATABASE_URL. Idempotent (safe to re-run).
 *   npm run db:migrate
 */
const schemaPath = resolve(process.cwd(), "db/schema.sql");
const sql = readFileSync(schemaPath, "utf8");

getPool()
  .query(sql)
  .then(() => {
    console.log("✓ Esquema aplicado a la base de datos.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗ La migración falló:", e.message);
    process.exit(1);
  });
