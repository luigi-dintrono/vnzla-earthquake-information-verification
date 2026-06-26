"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Polling-based live feed (Neon has no hosted realtime). Re-fetches the server
 * component on an interval and whenever the tab regains focus.
 */
export function FeedAutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router, intervalMs]);

  return (
    <div
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title="El feed se actualiza automáticamente"
    >
      <RefreshCw className="size-3.5" />
      Actualización automática
    </div>
  );
}
