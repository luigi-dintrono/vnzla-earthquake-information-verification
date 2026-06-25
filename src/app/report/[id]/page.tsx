import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, ExternalLink, Layers, MapPin } from "lucide-react";
import { getMyVote, getReport, getReportComments, getReportSources } from "@/lib/queries";
import { getVoter } from "@/lib/identity";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TimeAgo } from "@/components/TimeAgo";
import { VerifyPanel } from "@/components/VerifyPanel";
import { formatDateTime } from "@/lib/format";
import { SEVERITY_LABELS } from "@/lib/ui";
import { VOTE_LABELS, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<SourceType, string> = {
  x: "X",
  rss: "RSS",
  news: "Medio",
  manual: "Reporte ciudadano",
  other: "Fuente",
};

const VOTE_VAR: Record<string, string> = {
  confirm: "verified",
  dispute: "disputed",
  unsure: "unverified",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  return { title: report ? report.title : "Reporte" };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const voter = await getVoter();
  const [sources, comments, myVote] = await Promise.all([
    getReportSources(id),
    getReportComments(id),
    getMyVote(id, voter?.hash ?? null),
  ]);

  const hasMap = report.lat != null && report.lng != null;
  const lat = report.lat ?? 0;
  const lng = report.lng ?? 0;
  const d = 0.03;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Volver al feed
      </Link>

      <article className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          <CategoryBadge category={report.category} />
          {report.report_count > 1 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: "var(--verifying)", backgroundColor: "var(--verifying-soft)" }}
            >
              <Layers className="size-3" />
              Reportado por {report.source_count} fuente(s) · {report.report_count} publicaciones
            </span>
          )}
          {report.severity != null && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: report.severity >= 4 ? "var(--falsehood)" : "var(--disputed)",
                backgroundColor: report.severity >= 4 ? "var(--falsehood-soft)" : "var(--disputed-soft)",
              }}
            >
              Gravedad: {SEVERITY_LABELS[report.severity] ?? report.severity}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-xl font-bold leading-tight">{report.title}</h1>
        {report.summary && <p className="mt-2 text-sm text-foreground/80">{report.summary}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {report.location_text && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {report.location_text}
            </span>
          )}
          {report.occurred_at && (
            <span className="inline-flex items-center gap-1" title={formatDateTime(report.occurred_at)}>
              <Clock className="size-3.5" />
              Ocurrió <TimeAgo iso={report.occurred_at} />
            </span>
          )}
          <span>
            Actualizado <TimeAgo iso={report.last_seen_at} />
          </span>
        </div>

        {hasMap && (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <iframe
              title="Mapa de la ubicación"
              src={embedSrc}
              className="h-56 w-full"
              loading="lazy"
            />
            <a
              href={osmLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 border-t bg-muted py-1.5 text-xs font-medium text-[color:var(--primary)] hover:underline"
            >
              Ver en el mapa <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </article>

      <VerifyPanel
        reportId={report.id}
        confirm={report.confirm_count}
        dispute={report.dispute_count}
        unsure={report.unsure_count}
        status={report.status}
        myVote={myVote}
      />

      <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          Fuentes que reportan esto{" "}
          <span className="font-normal text-muted-foreground">({sources.length})</span>
        </h2>
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li key={s.raw_item_id} className="flex items-start justify-between gap-3 border-t pt-2 text-sm first:border-0 first:pt-0">
              <div className="min-w-0">
                <span className="font-medium">{s.source_name ?? SOURCE_LABEL[s.source_type]}</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {SOURCE_LABEL[s.source_type]}
                </span>
                <div className="text-xs text-muted-foreground">
                  {s.author && <span>{s.author} · </span>}
                  <TimeAgo iso={s.captured_at} />
                </div>
              </div>
              {s.raw_url && (
                <a
                  href={s.raw_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
                >
                  Abrir <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
          {sources.length === 0 && (
            <li className="text-sm text-muted-foreground">Sin fuentes vinculadas todavía.</li>
          )}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          Aportes de la comunidad{" "}
          <span className="font-normal text-muted-foreground">({comments.length})</span>
        </h2>
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border-t pt-3 text-sm first:border-0 first:pt-0">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    color: `var(--${VOTE_VAR[c.vote]})`,
                    backgroundColor: `var(--${VOTE_VAR[c.vote]}-soft)`,
                  }}
                >
                  {VOTE_LABELS[c.vote]}
                </span>
                <span className="text-xs text-muted-foreground">
                  <TimeAgo iso={c.created_at} />
                </span>
              </div>
              {c.comment && <p className="mt-1 text-foreground/85">{c.comment}</p>}
              {c.evidence_url && (
                <a
                  href={c.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
                >
                  Evidencia <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
          {comments.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Aún no hay aportes. Si sabes algo, verifícalo arriba y deja un comentario.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
