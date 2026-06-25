import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { hasSupabaseAdmin } from "@/lib/env";
import { runIngest } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  }
  try {
    const summary = await runIngest();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/ingest]", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
