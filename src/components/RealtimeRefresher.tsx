"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Listens for new/updated reports and offers a one-tap refresh. */
export function RealtimeRefresher() {
  const router = useRouter();
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel("reports-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () =>
        setHasNew(true),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  if (!hasNew) return null;

  return (
    <button
      onClick={() => {
        setHasNew(false);
        router.refresh();
      }}
      className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-md transition hover:opacity-90"
    >
      <RefreshCw className="size-4" />
      Hay información nueva — actualizar
    </button>
  );
}
