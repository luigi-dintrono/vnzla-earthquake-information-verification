import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureVoter } from "@/lib/identity";
import { hasDatabase, query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  reportId: z.string().uuid(),
  vote: z.enum(["confirm", "dispute", "unsure"]),
  comment: z.string().max(1000).nullish(),
  evidenceUrl: z.union([z.string().url().max(500), z.literal("")]).nullish(),
});

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
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

  try {
    await query(
      `INSERT INTO verifications (report_id, voter_hash, vote, comment, evidence_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (report_id, voter_hash)
       DO UPDATE SET vote = EXCLUDED.vote,
                     comment = EXCLUDED.comment,
                     evidence_url = EXCLUDED.evidence_url,
                     created_at = now()`,
      [reportId, voter.hash, vote, comment?.trim() || null, evidenceUrl?.trim() || null],
    );
  } catch (e) {
    console.error("[verify]", (e as Error).message);
    return NextResponse.json({ error: "No se pudo registrar tu verificación." }, { status: 500 });
  }

  // Counts + status are recomputed by a DB trigger; read the fresh values.
  const report = await queryOne(
    "SELECT confirm_count, dispute_count, unsure_count, status FROM reports WHERE id = $1",
    [reportId],
  );

  return NextResponse.json({ ok: true, vote, report });
}
