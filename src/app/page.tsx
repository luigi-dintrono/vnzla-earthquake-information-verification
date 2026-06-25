import Link from "next/link";
import { getFeed, getStates, getStats, type FeedFilters, type FeedSort } from "@/lib/queries";
import { hasSupabase } from "@/lib/env";
import { ReportCard } from "@/components/ReportCard";
import { Filters } from "@/components/Filters";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Notice } from "@/components/Notice";
import { formatNumber } from "@/lib/format";
import type { ReportCategory, ReportStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
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

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  if (!hasSupabase()) {
    return (
      <Notice title="Configura Supabase para empezar" tone="warn">
        <p>
          Copia <code>.env.example</code> a <code>.env.local</code> y agrega tus claves de Supabase,
          ejecuta la migración de <code>supabase/migrations/0001_init.sql</code> y luego{" "}
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
  };
  const hasFilters = Boolean(filters.category || filters.status || filters.state || filters.q);

  const [reports, states, stats] = await Promise.all([getFeed(filters), getStates(), getStats()]);

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold leading-tight">Feed de información verificada</h1>
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

      <div className="flex justify-center">
        <RealtimeRefresher />
      </div>

      {reports.length === 0 ? (
        hasFilters ? (
          <Notice title="Sin resultados">
            No hay reportes con esos filtros.{" "}
            <Link href="/" className="font-semibold underline">
              Limpiar filtros
            </Link>
            .
          </Notice>
        ) : (
          <Notice title="Aún no hay reportes">
            <p>
              Carga datos de ejemplo con <code>npm run seed</code>, activa el crawler con{" "}
              <code>npm run ingest &amp;&amp; npm run process</code>, o{" "}
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
