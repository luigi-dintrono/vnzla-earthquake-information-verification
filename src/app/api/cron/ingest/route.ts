import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { env, hasDatabase } from "@/lib/env";
import { runIngest } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  }
  try {
    const summary = await runIngest({ sinceHours: env.ingestWindowHours });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/ingest]", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
