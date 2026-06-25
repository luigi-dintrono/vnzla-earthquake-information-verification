import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureVoter } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { processRawItemById } from "@/lib/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(8, "Escribe al menos una frase.").max(4000),
  url: z.union([z.string().url("URL inválida").max(500), z.literal("")]).nullish(),
  author: z.string().max(120).nullish(),
});

const MANUAL_SOURCE_NAME = "Reporte ciudadano";

async function manualSourceId(db: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const { data: existing } = await db
    .from("sources")
    .select("id")
    .eq("type", "manual")
    .eq("name", MANUAL_SOURCE_NAME)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from("sources")
    .insert({ type: "manual", name: MANUAL_SOURCE_NAME, trust_weight: 0.6 })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const { text, url, author } = parsed.data;

  const voter = await ensureVoter();
  const db = supabaseAdmin();

  let sourceId: string;
  try {
    sourceId = await manualSourceId(db);
  } catch (e) {
    console.error("[submit] source", (e as Error).message);
    return NextResponse.json({ error: "No se pudo registrar el reporte." }, { status: 500 });
  }

  const external_id = "sub_" + createHash("sha1").update(`${text}|${url ?? ""}`).digest("hex").slice(0, 24);

  const { data: item, error } = await db
    .from("raw_items")
    .insert({
      source_id: sourceId,
      external_id,
      author: author?.trim() || "Anónimo",
      raw_text: text.trim(),
      raw_url: url?.trim() || null,
      lang: "es",
      captured_at: new Date().toISOString(),
      submitted_by: voter.hash,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // Unique violation -> this exact report already exists.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    console.error("[submit]", error.message);
    return NextResponse.json({ error: "No se pudo registrar el reporte." }, { status: 500 });
  }

  // Run it through augment + dedup now so it appears in the feed immediately.
  // If this fails, the next process cron will pick it up.
  let reportId: string | null = null;
  try {
    const outcome = await processRawItemById(item!.id as string);
    reportId = outcome?.reportId ?? null;
  } catch (e) {
    console.warn("[submit] inline process deferred:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, reportId });
}
