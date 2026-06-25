import { CATEGORY_LABELS, type ReportCategory } from "@/lib/types";
import { CATEGORY_EMOJI } from "@/lib/ui";

export function CategoryBadge({ category }: { category: ReportCategory }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span aria-hidden>{CATEGORY_EMOJI[category]}</span>
      {CATEGORY_LABELS[category]}
    </span>
  );
}
