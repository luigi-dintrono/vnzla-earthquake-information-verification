import { notFound } from "next/navigation";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { env, hasDatabase } from "@/lib/env";
import { getSourcesOverview, type SourceOverview } from "@/lib/queries";
import { AddSourceForm } from "@/components/AddSourceForm";
import { Notice } from "@/components/Notice";
import { timeAgo } from "@/lib/format";
import type { SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

const SOURCE_LABEL: Record<SourceType, string> = {
  x: "X",
  rss: "RSS",
  news: "Medio",
  manual: "Ciudadano",
  other: "Otra",
};

const GROUPS: { title: string; hint: string; types: SourceType[] }[] = [
  { title: "Cuentas de X", hint: "Instituciones oficiales · vía gateway", types: ["x"] },
  { title: "Medios y RSS", hint: "Feeds directos · sin gateway", types: ["news", "rss"] },
  { title: "Comunidad", hint: "Reportes ciudadanos", types: ["manual"] },
  { title: "Otras", hint: "", types: ["other"] },
];

/** Active + recently pulled = green; active but empty = amber; inactive = grey. */
function statusOf(s: SourceOverview): { color: string; label: string } {
  if (!s.active) return { color: "var(--muted-foreground)", label: "Inactiva" };
  if (s.item_count === 0) return { color: "var(--disputed)", label: "Sin datos aún" };
  return { color: "var(--verified)", label: "Activa" };
}

function TrustBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confianza ${value.toFixed(2)} de 1`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--primary)" }} />
      </span>
      <span className="tabular-nums text-[11px] text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

function SourceRow({ s }: { s: SourceOverview }) {
  const status = statusOf(s);
  return (
    <li className="flex items-start gap-3 p-3">
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: status.color }}
        title={status.label}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{s.name}</span>
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {SOURCE_LABEL[s.type]}
          </span>
        </div>
        {(s.handle || s.url) &&
          (s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              <span className="truncate">{s.url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.handle}</p>
          ))}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <TrustBar value={s.trust_weight} />
          <span className="tabular-nums">
            <strong className="font-semibold text-foreground">{s.item_count}</strong> items
          </span>
          {s.last_item_at && <span>· {timeAgo(s.last_item_at)}</span>}
          <span className="ml-auto font-medium" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>
    </li>
  );
}

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // No slug configured, or it doesn't match → behave as if the page doesn't exist.
  if (!env.adminSlug || slug !== env.adminSlug) notFound();

  const sources = hasDatabase() ? await getSourcesOverview() : [];
  const activeCrawled = sources.filter((s) => s.active && s.type !== "manual").length;
  const xGatewayReady = env.xConnectorEnabled && Boolean(env.xFeedGateway);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fuentes que VerificaVE rastrea para reunir información base. Página privada: no la
          compartas, el enlace es la única llave.
        </p>
      </header>

      {!hasDatabase() && (
        <Notice title="Base de datos no configurada" tone="warn">
          Define <code>DATABASE_URL</code> para ver y administrar fuentes.
        </Notice>
      )}

      {/* X connector status — visibility into whether handles actually crawl. */}
      <Notice
        title={xGatewayReady ? "Conector de X activo" : "Conector de X inactivo"}
        tone={xGatewayReady ? "info" : "warn"}
      >
        {xGatewayReady ? (
          <>
            Las cuentas de X se rastrean vía <code>{env.xFeedGateway}</code>. Cuentas inactivas (sin
            publicaciones recientes) aparecen sin datos.
          </>
        ) : (
          <>
            Las cuentas de X están registradas pero <strong>no se rastrean todavía</strong>: falta{" "}
            <code>X_CONNECTOR_ENABLED=true</code> y/o <code>X_FEED_GATEWAY</code>. Los feeds RSS y de
            medios sí se rastrean.
          </>
        )}
      </Notice>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Fuentes que rastreamos</h2>
          <span className="text-xs text-muted-foreground">{activeCrawled} activas</span>
        </div>

        {sources.length === 0 && (
          <p className="rounded-[var(--radius-card)] border bg-card p-3 text-sm text-muted-foreground shadow-sm">
            Aún no hay fuentes registradas.
          </p>
        )}

        {GROUPS.map((group) => {
          const rows = sources.filter((s) => group.types.includes(s.type));
          if (rows.length === 0) return null;
          return (
            <div key={group.title}>
              <div className="mb-1.5 flex items-baseline gap-2 px-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                {group.hint && (
                  <span className="text-[11px] text-muted-foreground/70">· {group.hint}</span>
                )}
              </div>
              <ul className="divide-y rounded-[var(--radius-card)] border bg-card shadow-sm">
                {rows.map((s) => (
                  <SourceRow key={s.id} s={s} />
                ))}
              </ul>
            </div>
          );
        })}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0" /> Toda la información del feed proviene de estas
          fuentes, más reportes ciudadanos verificados por la comunidad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Agregar una fuente</h2>
        <AddSourceForm slug={slug} />
      </section>
    </div>
  );
}
