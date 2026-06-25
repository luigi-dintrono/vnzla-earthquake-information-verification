import { STATUS_LABELS, type ReportStatus } from "@/lib/types";
import { STATUS_VAR } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  size = "md",
}: {
  status: ReportStatus;
  size?: "sm" | "md";
}) {
  const v = STATUS_VAR[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
      style={{ color: `var(--${v})`, backgroundColor: `var(--${v}-soft)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--${v})` }} />
      {STATUS_LABELS[status]}
    </span>
  );
}
