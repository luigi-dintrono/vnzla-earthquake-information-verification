import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { getFeed, getStates, getStats, type FeedFilters, type FeedSort } from "@/lib/queries";
import { hasDatabase } from "@/lib/env";
import { ReportCard } from "@/components/ReportCard";
import { Filters } from "@/components/Filters";
import { FeedAutoRefresh } from "@/components/FeedAutoRefresh";
import { Notice } from "@/components/Notice";
import { formatNumber } from "@/lib/format";
import type { ReportCategory, ReportStatus } from "@/lib/types";

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular-nums">{formatNumber(value)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** The feed, shared by the real (/) and demo (/demo) routes. */
export async function FeedView({ demo, searchParams }: { demo: boolean; searchParams: SP }) {
  const sp = searchParams;
  const basePath = demo ? "/demo" : "/";

  if (!hasDatabase()) {
    return (
      <Notice title="Configura la base de datos para empezar" tone="warn">
        <p>
          Copia <code>.env.example</code> a <code>.env.local</code> y agrega tu{" "}
          <code>DATABASE_URL</code> de Neon, luego ejecuta <code>npm run db:migrate</code> y{" "}
          <code>npm run seed</code> para cargar datos de ejemplo. El README tiene el paso a paso.
        </p>
      </Notice>
    );
  }

  const filters: FeedFilters = {
    category: one(sp.category) as ReportCategory | undefined,
    status: one(sp.status) as ReportStatus | undefined,
    state: one(sp.state),
    q: one(sp.q),
    sort: (one(sp.sort) as FeedSort) ?? "recent",
    demo,
  };
  const hasFilters = Boolean(filters.category || filters.status || filters.state || filters.q);

  const [reports, states, stats] = await Promise.all([
    getFeed(filters),
    getStates(demo),
    getStats(demo),
  ]);

  return (
    <div className="space-y-5">
      {demo && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius-card)] border p-3 text-sm"
          style={{ borderColor: "var(--verifying)", backgroundColor: "var(--verifying-soft)" }}
        >
          <FlaskConical className="mt-0.5 size-4 shrink-0" style={{ color: "var(--verifying)" }} />
          <p>
            <strong>Datos de demostración.</strong> Ejemplo de cómo se ve el feed durante un
            terremoto.{" "}
            <Link href="/" className="font-semibold underline underline-offset-2">
              Ver el feed real
            </Link>
            .
          </p>
        </div>
      )}

      <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold leading-tight">
          {demo ? "Feed de demostración" : "Feed de información verificada"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reportes de varias fuentes, sin duplicados. La comunidad verifica qué es cierto.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 border-t pt-3">
          <Stat value={stats.reports} label="reportes" />
          <Stat value={stats.verified} label="verificados" />
          <Stat value={stats.sources} label="fuentes" />
          <Stat value={stats.verifications} label="verificaciones" />
        </div>
      </section>

      <Filters states={states} />

      <div className="flex justify-end">
        <FeedAutoRefresh />
      </div>

      {reports.length === 0 ? (
        hasFilters ? (
          <Notice title="Sin resultados">
            No hay reportes con esos filtros.{" "}
            <Link href={basePath} className="font-semibold underline">
              Limpiar filtros
            </Link>
            .
          </Notice>
        ) : demo ? (
          <Notice title="Sin datos de demostración">
            <p>
              Carga el ejemplo con <code>npm run seed</code>.
            </p>
          </Notice>
        ) : (
          <Notice title="Aún no hay reportes reales">
            <p>
              El crawler aún no ha reunido información. Mira el{" "}
              <Link href="/demo" className="font-semibold underline">
                feed de demostración
              </Link>{" "}
              o{" "}
              <Link href="/submit" className="font-semibold underline">
                reporta la primera información
              </Link>
              .
            </p>
          </Notice>
        )
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
