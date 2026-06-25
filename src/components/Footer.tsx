import { TriangleAlert } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-10 border-t">
      <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: "var(--disputed)" }} />
          <span>
            <strong className="text-foreground">VerificaVE</strong> reúne reportes de varias fuentes
            y verificación de la comunidad. La información <strong>no está confirmada oficialmente</strong>;
            contrástala antes de tomar decisiones. Ante una emergencia, llama al <strong>171</strong>.
          </span>
        </p>
        <p className="mt-3">
          Hecho para ayudar a la población venezolana a encontrar información confiable. Código abierto.
        </p>
      </div>
    </footer>
  );
}
