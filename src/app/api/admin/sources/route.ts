import { NextResponse } from "next/server";
import { z } from "zod";
import { env, hasDatabase } from "@/lib/env";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  // The secret slug doubles as the auth token for writes.
  slug: z.string().min(1),
  type: z.enum(["x", "rss", "news", "other"]),
  name: z.string().trim().min(2, "Nombre demasiado corto.").max(120),
  handle: z.string().trim().max(60).optional().or(z.literal("")),
  url: z.string().url("URL inválida").max(500).optional().or(z.literal("")),
  trust_weight: z.coerce.number().min(0).max(1).default(0.7),
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
  const { slug, type, name, trust_weight } = parsed.data;
  const handle = parsed.data.handle?.trim() || null;
  const url = parsed.data.url?.trim() || null;

  // Guard: only the holder of the secret slug may add sources.
  if (!env.adminSlug || slug !== env.adminSlug) {
    return NextResponse.json({ error: "No autorizado." }, { status: 404 });
  }

  // Each medium needs the field its connector crawls.
  if (type === "x" && !handle) {
    return NextResponse.json({ error: "Las cuentas de X requieren un @handle." }, { status: 400 });
  }
  if ((type === "rss" || type === "news") && !url) {
    return NextResponse.json({ error: "Las fuentes RSS/medios requieren una URL de feed." }, { status: 400 });
  }

  // De-dupe: same type + same handle (X) or url (feeds) already tracked.
  const dupe = await queryOne<{ id: string }>(
    `SELECT id FROM sources
     WHERE type = $1 AND (
       ($2::text IS NOT NULL AND lower(handle) = lower($2)) OR
       ($3::text IS NOT NULL AND lower(url) = lower($3))
     ) LIMIT 1`,
    [type, handle, url],
  );
  if (dupe) {
    return NextResponse.json({ error: "Esa fuente ya está registrada." }, { status: 409 });
  }

  try {
    const row = await queryOne<{ id: string }>(
      "INSERT INTO sources (type, name, handle, url, trust_weight) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [type, name, handle, url, trust_weight],
    );
    return NextResponse.json({ ok: true, id: row!.id });
  } catch (e) {
    console.error("[admin/sources]", (e as Error).message);
    return NextResponse.json({ error: "No se pudo registrar la fuente." }, { status: 500 });
  }
}
