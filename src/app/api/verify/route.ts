import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureVoter } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  reportId: z.string().uuid(),
  vote: z.enum(["confirm", "dispute", "unsure"]),
  comment: z.string().max(1000).nullish(),
  evidenceUrl: z.union([z.string().url().max(500), z.literal("")]).nullish(),
});

export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const { reportId, vote, comment, evidenceUrl } = parsed.data;

  // Mints + sets the signed voter cookie on first vote. The unique constraint
  // (report_id, voter_hash) enforces one vote per device per report.
  const voter = await ensureVoter();
  const db = supabaseAdmin();

  const { error } = await db.from("verifications").upsert(
    {
      report_id: reportId,
      voter_hash: voter.hash,
      vote,
      comment: comment?.trim() || null,
      evidence_url: evidenceUrl?.trim() || null,
    },
    { onConflict: "report_id,voter_hash" },
  );

  if (error) {
    console.error("[verify]", error.message);
    return NextResponse.json({ error: "No se pudo registrar tu verificación." }, { status: 500 });
  }

  // Counts + status are recomputed by a DB trigger; read the fresh values.
  const { data: report } = await db
    .from("reports")
    .select("confirm_count, dispute_count, unsure_count, status")
    .eq("id", reportId)
    .single();

  return NextResponse.json({ ok: true, vote, report });
}
