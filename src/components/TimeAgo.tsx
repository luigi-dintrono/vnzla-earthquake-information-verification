"use client";

import { useEffect, useState } from "react";
import { formatDateTime, timeAgo } from "@/lib/format";

/** Relative time that refreshes once a minute on the client; absolute on hover. */
export function TimeAgo({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!iso) return null;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {timeAgo(iso)}
    </time>
  );
}
