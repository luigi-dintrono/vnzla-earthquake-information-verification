"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SourceType } from "@/lib/types";

const TYPES: { value: SourceType; label: string; needs: "handle" | "url" }[] = [
  { value: "x", label: "Cuenta de X", needs: "handle" },
  { value: "rss", label: "Feed RSS", needs: "url" },
  { value: "news", label: "Medio / noticias", needs: "url" },
  { value: "other", label: "Otra", needs: "url" },
];

export function AddSourceForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [type, setType] = useState<SourceType>("x");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  const [trust, setTrust] = useState("0.7");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const needs = TYPES.find((t) => t.value === type)!.needs;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          type,
          name: name.trim(),
          handle: handle.trim(),
          url: url.trim(),
          trust_weight: Number(trust),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo agregar la fuente.");
      setDone("Fuente agregada. Se incluirá en el próximo rastreo.");
      setName("");
      setHandle("");
      setUrl("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="src-type" className="text-sm font-medium">
            Tipo de fuente
          </label>
          <select
            id="src-type"
            value={type}
            onChange={(e) => setType(e.target.value as SourceType)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="src-name" className="text-sm font-medium">
            Nombre <span style={{ color: "var(--falsehood)" }}>*</span>
          </label>
          <input
            id="src-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej.: Protección Civil"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {needs === "handle" ? (
        <div>
          <label htmlFor="src-handle" className="text-sm font-medium">
            Cuenta (@handle) <span style={{ color: "var(--falsehood)" }}>*</span>
          </label>
          <input
            id="src-handle"
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@ProteccionCivil"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se rastrea vía el gateway configurado (X_FEED_GATEWAY).
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="src-url" className="text-sm font-medium">
            URL del feed <span style={{ color: "var(--falsehood)" }}>*</span>
          </label>
          <input
            id="src-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/feed/"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="max-w-[12rem]">
        <label htmlFor="src-trust" className="text-sm font-medium">
          Confianza (0 a 1)
        </label>
        <input
          id="src-trust"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={trust}
          onChange={(e) => setTrust(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          1 = máxima confianza (fuente oficial) · 0.7 medio · 0.5 dudosa.
        </p>
      </div>

      {err && <p className="text-sm" style={{ color: "var(--falsehood)" }}>{err}</p>}
      {done && <p className="text-sm" style={{ color: "var(--verified)" }}>{done}</p>}

      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="size-4" />
        {busy ? "Agregando…" : "Agregar fuente"}
      </button>
    </form>
  );
}
