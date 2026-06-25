"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/types";

const SORTS: [string, string][] = [
  ["recent", "Más recientes"],
  ["corroborated", "Más reportados"],
  ["discussed", "Más verificados"],
];

export function Filters({ states }: { states: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setParam("q", String(fd.get("q") ?? "").trim());
  }

  const select =
    "rounded-lg border bg-card px-2.5 py-1.5 text-sm text-foreground shadow-sm";

  return (
    <div className="space-y-2">
      <form onSubmit={onSearch} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={sp.get("q") ?? ""}
          placeholder="Buscar por lugar, edificio o palabra clave…"
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm shadow-sm"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          className={select}
          value={sp.get("category") ?? ""}
          onChange={(e) => setParam("category", e.target.value)}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          className={select}
          value={sp.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
          aria-label="Estado de verificación"
        >
          <option value="">Cualquier verificación</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {states.length > 0 && (
          <select
            className={select}
            value={sp.get("state") ?? ""}
            onChange={(e) => setParam("state", e.target.value)}
            aria-label="Estado / región"
          >
            <option value="">Todo el país</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <select
          className={select}
          value={sp.get("sort") ?? "recent"}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Ordenar"
        >
          {SORTS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {pending && <span className="self-center text-xs text-muted-foreground">Actualizando…</span>}
      </div>
    </div>
  );
}
