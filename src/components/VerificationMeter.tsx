export function VerificationMeter({
  confirm,
  dispute,
  unsure,
  compact = false,
}: {
  confirm: number;
  dispute: number;
  unsure: number;
  compact?: boolean;
}) {
  const total = confirm + dispute + unsure;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún sin verificaciones — sé la primera persona en verificar.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Resultado de verificaciones">
        <div style={{ width: `${pct(confirm)}%`, backgroundColor: "var(--verified)" }} />
        <div style={{ width: `${pct(unsure)}%`, backgroundColor: "var(--unverified)" }} />
        <div style={{ width: `${pct(dispute)}%`, backgroundColor: "var(--disputed)" }} />
      </div>
      {!compact && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span style={{ color: "var(--verified)" }}>{confirm} confirman</span>
          <span style={{ color: "var(--disputed)" }}>{dispute} dudan</span>
          {unsure > 0 && <span className="text-muted-foreground">{unsure} no saben</span>}
        </div>
      )}
    </div>
  );
}
