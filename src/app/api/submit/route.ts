import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureVoter } from "@/lib/identity";
import { hasDatabase, queryOne } from "@/lib/db";
import { processRawItemById } from "@/lib/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(8, "Escribe al menos una frase.").max(4000),
  url: z.string().url("Agrega un enlace válido a la fuente.").max(500),
  author: z.string().trim().min(1, "Indica el autor o cuenta original.").max(120),
});

const MANUAL_SOURCE_NAME = "Reporte ciudadano";

async function manualSourceId(): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM sources WHERE type = 'manual' AND name = $1 LIMIT 1",
    [MANUAL_SOURCE_NAME],
  );
  if (existing) return existing.id;
  const row = await queryOne<{ id: string }>(
    "INSERT INTO sources (type, name, trust_weight) VALUES ('manual', $1, 0.6) RETURNING id",
    [MANUAL_SOURCE_NAME],
  );
  return row!.id;
}

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, url, author } = parsed.data;

  const voter = await ensureVoter();

  let sourceId: string;
  try {
    sourceId = await manualSourceId();
  } catch (e) {
    console.error("[submit] source", (e as Error).message);
    return NextResponse.json({ error: "No se pudo registrar el reporte." }, { status: 500 });
  }

  const external_id = "sub_" + createHash("sha1").update(`${text}|${url ?? ""}`).digest("hex").slice(0, 24);

  let itemId: string;
  try {
    const item = await queryOne<{ id: string }>(
      `INSERT INTO raw_items (source_id, external_id, author, raw_text, raw_url, lang, captured_at, submitted_by, status)
       VALUES ($1, $2, $3, $4, $5, 'es', now(), $6, 'pending')
       RETURNING id`,
      [sourceId, external_id, author.trim(), text.trim(), url.trim(), voter.hash],
    );
    itemId = item!.id;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      // Unique violation -> this exact report already exists.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[submit]", (e as Error).message);
    return NextResponse.json({ error: "No se pudo registrar el reporte." }, { status: 500 });
  }

  // Run it through augment + dedup now so it appears in the feed immediately.
  // If this fails, the next process cron will pick it up.
  let reportId: string | null = null;
  try {
    const outcome = await processRawItemById(itemId);
    reportId = outcome?.reportId ?? null;
  } catch (e) {
    console.warn("[submit] inline process deferred:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, reportId });
}
