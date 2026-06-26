"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ListFilter, Search, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type ReportCategory,
  type ReportStatus,
} from "@/lib/types";

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

  const category = sp.get("category") ?? "";
  const status = sp.get("status") ?? "";
  const state = sp.get("state") ?? "";
  const sort = sp.get("sort") ?? "recent";
  const q = sp.get("q") ?? "";

  // Active narrowing filters, shown as removable chips.
  const chips = [
    category && { key: "category", label: CATEGORY_LABELS[category as ReportCategory] ?? category },
    status && { key: "status", label: STATUS_LABELS[status as ReportStatus] ?? status },
    state && { key: "state", label: state },
  ].filter(Boolean) as { key: string; label: string }[];

  const [open, setOpen] = useState(() => chips.length > 0);

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

  function clearFilters() {
    const next = new URLSearchParams(sp.toString());
    ["category", "status", "state"].forEach((k) => next.delete(k));
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  const selectCls =
    "w-full rounded-lg border bg-card px-2.5 py-2 text-sm text-foreground shadow-sm";

  return (
    <div className="space-y-2">
      {/* Row 1: search + filters toggle */}
      <div className="flex gap-2">
        <form onSubmit={onSearch} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por lugar, edificio o palabra clave…"
            className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm shadow-sm"
          />
        </form>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
        >
          <ListFilter className="size-4" />
          Filtros
          {chips.length > 0 && (
            <span
              className="grid size-5 place-items-center rounded-full text-[11px] font-bold text-[color:var(--primary-foreground)]"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setParam(c.key, "")}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {c.label}
              <X className="size-3" />
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-[color:var(--primary)] hover:underline"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Collapsible controls */}
      {open && (
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border bg-muted/30 p-2 sm:grid-cols-4">
          <select
            className={selectCls}
            value={category}
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
            className={selectCls}
            value={status}
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
              className={selectCls}
              value={state}
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
            className={selectCls}
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            aria-label="Ordenar"
          >
            {SORTS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {pending && <span className="text-xs text-muted-foreground">Actualizando…</span>}
    </div>
  );
}
