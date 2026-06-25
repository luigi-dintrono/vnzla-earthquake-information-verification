"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";
import { type ReportStatus, type VoteType } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { VerificationMeter } from "./VerificationMeter";
import { cn } from "@/lib/utils";

interface Option {
  vote: VoteType;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  varName: string;
}

const OPTIONS: Option[] = [
  { vote: "confirm", label: "Lo confirmo", Icon: Check, varName: "verified" },
  { vote: "dispute", label: "Lo dudo / es falso", Icon: X, varName: "disputed" },
  { vote: "unsure", label: "No estoy seguro", Icon: HelpCircle, varName: "unverified" },
];

export function VerifyPanel({
  reportId,
  confirm,
  dispute,
  unsure,
  status,
  myVote,
}: {
  reportId: string;
  confirm: number;
  dispute: number;
  unsure: number;
  status: ReportStatus;
  myVote: VoteType | null;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState({ confirm, dispute, unsure });
  const [curStatus, setCurStatus] = useState<ReportStatus>(status);
  const [vote, setVote] = useState<VoteType | null>(myVote);
  const [busy, setBusy] = useState<VoteType | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function cast(v: VoteType) {
    setBusy(v);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId,
          vote: v,
          comment: comment.trim() || null,
          evidenceUrl: evidence.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar tu verificación.");
      setVote(v);
      if (data.report) {
        setCounts({
          confirm: data.report.confirm_count,
          dispute: data.report.dispute_count,
          unsure: data.report.unsure_count,
        });
        setCurStatus(data.report.status as ReportStatus);
      }
      setMsg(vote === v ? "Verificación actualizada." : "¡Gracias! Tu verificación quedó registrada.");
      setComment("");
      setEvidence("");
      setShowMore(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Verificación de la comunidad</h2>
        <StatusBadge status={curStatus} />
      </div>

      <div className="mt-3">
        <VerificationMeter confirm={counts.confirm} dispute={counts.dispute} unsure={counts.unsure} />
      </div>

      <p className="mt-4 text-sm font-medium">¿Esta información es correcta según lo que sabes?</p>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ vote: v, label, Icon, varName }) => {
          const selected = vote === v;
          return (
            <button
              key={v}
              onClick={() => cast(v)}
              disabled={busy !== null}
              aria-pressed={selected}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60",
                selected ? "ring-2" : "hover:bg-muted",
              )}
              style={
                selected
                  ? {
                      color: `var(--${varName})`,
                      backgroundColor: `var(--${varName}-soft)`,
                      borderColor: `var(--${varName})`,
                    }
                  : undefined
              }
            >
              <Icon className="size-4" />
              {busy === v ? "Enviando…" : label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="mt-3 text-xs font-medium text-[color:var(--primary)] hover:underline"
      >
        {showMore ? "Ocultar" : "Agregar comentario o evidencia (opcional)"}
      </button>

      {showMore && (
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué sabes? Aporta contexto que ayude a otras personas."
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <input
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Enlace de evidencia (foto, video, noticia)…"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            El comentario se guarda junto con tu próxima verificación.
          </p>
        </div>
      )}

      {msg && <p className="mt-3 text-xs" style={{ color: "var(--verified)" }}>{msg}</p>}
      {err && <p className="mt-3 text-xs" style={{ color: "var(--falsehood)" }}>{err}</p>}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Se registra una verificación por dispositivo. Puedes cambiar tu voto cuando quieras.
      </p>
    </section>
  );
}
