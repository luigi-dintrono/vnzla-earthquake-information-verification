"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const onSubmit = pathname?.startsWith("/submit");

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-lg text-[color:var(--primary-foreground)]"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <ShieldCheck className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">VerificaVE</span>
            <span className="block text-[11px] text-muted-foreground">
              Información verificada tras el terremoto
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-muted",
              !onSubmit && "bg-muted",
            )}
          >
            Feed
          </Link>
          <Link
            href="/submit"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
          >
            + Reportar
          </Link>
        </nav>
      </div>
    </header>
  );
}
