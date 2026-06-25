import { type ReactNode } from "react";

export function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  const color = tone === "warn" ? "var(--disputed)" : "var(--verifying)";
  const soft = tone === "warn" ? "var(--disputed-soft)" : "var(--verifying-soft)";
  return (
    <div
      className="rounded-[var(--radius-card)] border p-4 text-sm"
      style={{ borderColor: color, backgroundColor: soft }}
    >
      <p className="font-semibold" style={{ color }}>
        {title}
      </p>
      <div className="mt-1 text-foreground/80">{children}</div>
    </div>
  );
}
