import { SubmitForm } from "@/components/SubmitForm";
import { Notice } from "@/components/Notice";
import { hasDatabase } from "@/lib/env";

export const metadata = { title: "Reportar información" };

export default function SubmitPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold">Reportar información</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparte algo que viste o una fuente. Se agrupa con reportes similares y la comunidad lo
          verifica.
        </p>
      </header>

      {hasDatabase() ? (
        <SubmitForm />
      ) : (
        <Notice title="Configura la base de datos para recibir reportes" tone="warn">
          Agrega tu <code>DATABASE_URL</code> de Neon en <code>.env.local</code> y ejecuta{" "}
          <code>npm run db:migrate</code>. Mira el README.
        </Notice>
      )}

      <section className="rounded-[var(--radius-card)] border bg-card p-4 text-sm shadow-sm">
        <h2 className="font-semibold">Cómo funciona</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Tu reporte se enriquece automáticamente con lugar, hora y edificio.</li>
          <li>Se compara con lo ya publicado: si es lo mismo, suma como otra fuente.</li>
          <li>Aparece en el feed para que la comunidad lo confirme o lo ponga en duda.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          No publiques datos personales ni difundas rumores como hechos. Ante una emergencia llama al{" "}
          <strong>171</strong>.
        </p>
      </section>
    </div>
  );
}
