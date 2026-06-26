"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, ListFilter, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const onSubmit = pathname?.startsWith("/submit");

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[color:var(--primary-foreground)]"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <ShieldCheck className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-bold">VerificaVE</span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
              Información verificada tras el terremoto
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1">
          <Link
            href="/"
            aria-label="Feed"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-muted sm:px-3",
              !onSubmit && "bg-muted",
            )}
          >
            <ListFilter className="size-4 sm:hidden" />
            <span className="hidden sm:inline">Feed</span>
          </Link>
          <Link
            href="/submit"
            aria-label="Reportar"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-sm transition hover:opacity-90 sm:px-3"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Reportar</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
