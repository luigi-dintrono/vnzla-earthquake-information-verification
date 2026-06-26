"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SubmitForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim(), url: url.trim(), author: author.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el reporte.");

      if (data.reportId) {
        router.push(`/report/${data.reportId}`);
        return;
      }
      setDone(
        data.duplicate
          ? "Esta información ya estaba reportada. ¡Gracias!"
          : "¡Recibido! Tu reporte entrará al feed en breve.",
      );
      setText("");
      setUrl("");
      setAuthor("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
      <div>
        <label htmlFor="text" className="text-sm font-medium">
          ¿Qué información quieres reportar? <span style={{ color: "var(--falsehood)" }}>*</span>
        </label>
        <textarea
          id="text"
          required
          minLength={8}
          maxLength={4000}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Reportan grietas en el Edificio Residencias Miramar, en Cumaná, estado Sucre. Vecinos evacuaron…"
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Incluye lugar, edificio y hora si los conoces. Otras personas lo verificarán.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="url" className="text-sm font-medium">
            Enlace de la fuente <span style={{ color: "var(--falsehood)" }}>*</span>
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="author" className="text-sm font-medium">
            Autor / cuenta original <span style={{ color: "var(--falsehood)" }}>*</span>
          </label>
          <input
            id="author"
            required
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="@cuenta o nombre del medio"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El enlace y el autor son obligatorios: ayudan a la comunidad a verificar de dónde viene la
        información.
      </p>

      {err && <p className="text-sm" style={{ color: "var(--falsehood)" }}>{err}</p>}
      {done && <p className="text-sm" style={{ color: "var(--verified)" }}>{done}</p>}

      <button
        type="submit"
        disabled={busy || text.trim().length < 8 || url.trim().length === 0 || author.trim().length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        <Send className="size-4" />
        {busy ? "Enviando…" : "Enviar al feed"}
      </button>
    </form>
  );
}
