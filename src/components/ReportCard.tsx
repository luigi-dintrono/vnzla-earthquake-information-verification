import Link from "next/link";
import { Layers, MapPin } from "lucide-react";
import type { Report } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { VerificationMeter } from "./VerificationMeter";
import { TimeAgo } from "./TimeAgo";

export function ReportCard({ report }: { report: Report }) {
  const when = report.occurred_at ?? report.last_seen_at;
  return (
    <Link
      href={`/report/${report.id}`}
      className="group block rounded-[var(--radius-card)] border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={report.status} />
        {report.report_count > 1 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: "var(--verifying)", backgroundColor: "var(--verifying-soft)" }}
            title={`Reportado por ${report.source_count} fuente(s), ${report.report_count} publicaciones`}
          >
            <Layers className="size-3" />
            {report.report_count} reportes
          </span>
        )}
      </div>

      <h3 className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:underline">
        {report.title}
      </h3>
      {report.summary && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{report.summary}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <CategoryBadge category={report.category} />
        {report.location_text && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {report.location_text}
          </span>
        )}
        <TimeAgo iso={when} />
      </div>

      <div className="mt-3">
        <VerificationMeter
          confirm={report.confirm_count}
          dispute={report.dispute_count}
          unsure={report.unsure_count}
          compact
        />
      </div>
    </Link>
  );
}
