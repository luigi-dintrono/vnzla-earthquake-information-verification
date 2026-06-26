import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = {
  title: "Cómo funciona (interno)",
  description: "Cómo VerificaVE valida y deduplica los reportes. Documento interno.",
  robots: { index: false, follow: false },
};

// Static page — plain-language overview, safe to share by link.
export const dynamic = "force-static";

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-[color:var(--primary-foreground)]"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm text-foreground/85">{children}</div>
    </section>
  );
}

function Step({ label }: { label: string }) {
  return (
    <span className="rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm">
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-muted-foreground">→</span>;
}

export default function HowItWorksPage() {
  return (
    <div className="space-y-5">
      <header>
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--verifying)", backgroundColor: "var(--verifying-soft)" }}
        >
          Documento interno
        </span>
        <h1 className="mt-2 text-xl font-bold">Cómo se valida y deduplica un reporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          En VerificaVE, <strong>“validar”</strong> no es un chequeo automático de verdad. La
          confianza se construye con dos señales: <strong>corroboración</strong> (cuántas fuentes
          independientes reportan lo mismo) y <strong>verificación de la comunidad</strong> (lo que
          la gente confirma o pone en duda). La <strong>deduplicación</strong> es el paso que agrupa
          el mismo hecho aunque venga descrito con palabras distintas.
        </p>
      </header>

      <div className="rounded-[var(--radius-card)] border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Step label="Alguien reporta" />
          <Arrow />
          <Step label="Se valida" />
          <Arrow />
          <Step label="Se enriquece" />
          <Arrow />
          <Step label="Se agrupa con lo similar" />
          <Arrow />
          <Step label="La comunidad verifica" />
        </div>
      </div>

      <Section n="1" title="Llega un reporte y se valida la entrada">
        <p>
          Cuando alguien envía información, primero comprobamos que esté bien formada: que tenga
          texto suficiente, un <strong>enlace a la fuente</strong> y un <strong>autor</strong>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A cada dispositivo se le asigna una identidad anónima, sin necesidad de cuenta ni datos
            personales.
          </li>
          <li>
            Si alguien vuelve a enviar exactamente lo mismo, se reconoce como repetido y no se crea
            otra entrada.
          </li>
          <li>
            Un reporte ciudadano entra al mismo flujo que cualquier otra fuente: a partir de aquí,
            todo se procesa por igual.
          </li>
        </ul>
      </Section>

      <Section n="2" title="Se enriquece con contexto">
        <p>
          Con apoyo de inteligencia artificial extraemos los datos clave del mensaje:{" "}
          <strong>qué pasó</strong>, <strong>dónde</strong> (ciudad y ubicación en el mapa), qué{" "}
          <strong>edificio o estructura</strong> y qué tan <strong>grave</strong> es. Así un mensaje
          desordenado se convierte en un reporte estructurado y comparable.
        </p>
      </Section>

      <Section n="3" title="Se agrupa con reportes similares (deduplicación)">
        <p>
          Cada reporte nuevo se compara con todo lo que ya tenemos para detectar si describe el{" "}
          <strong>mismo hecho</strong>. La comparación combina:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>El significado</strong> — entiende que dos textos hablan de lo mismo aunque usen
            palabras diferentes.
          </li>
          <li>
            <strong>La redacción</strong> — un respaldo que detecta textos parecidos.
          </li>
          <li>
            <strong>La ubicación</strong> — solo se agrupan reportes de la misma zona, para no
            mezclar hechos parecidos de ciudades distintas.
          </li>
        </ul>
        <p>
          Si coincide con una historia existente, se <strong>suma a ella</strong> y crece el contador
          de <strong>“reportado por N fuentes”</strong>. Si no, <strong>inicia una historia nueva</strong>.
          Esa cuenta de fuentes independientes es la primera señal de confianza.
        </p>
      </Section>

      <Section n="4" title="La comunidad lo verifica">
        <p>
          Todo reporte empieza <strong>sin verificar</strong>. Las personas indican{" "}
          <em>Lo confirmo</em>, <em>Lo dudo</em> o <em>No estoy seguro</em>, con{" "}
          <strong>un voto por dispositivo</strong>. A medida que llegan votos, el estado avanza solo:
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-xs">
            <StatusBadge status="verifying" size="sm" /> empiezan a llegar votos
          </span>
          <span className="flex items-center gap-2 text-xs">
            <StatusBadge status="verified" size="sm" /> la comunidad lo confirma de forma amplia
          </span>
          <span className="flex items-center gap-2 text-xs">
            <StatusBadge status="disputed" size="sm" /> las dudas superan a las confirmaciones
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Un reporte gana confianza por dos vías independientes: cuántas fuentes lo corroboran y cómo
          lo verifica la comunidad.
        </p>
      </Section>

      <Section n="5" title="Límites honestos y hacia dónde vamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            El agrupamiento es <strong>de mejor esfuerzo</strong>: puede unir de más o separar de
            más. La guardia de ubicación reduce los errores, pero no los elimina.
          </li>
          <li>
            <strong>No hay verificación automática de hechos.</strong> Una avalancha de votos
            malintencionados o una fuente coordinada podrían inducir a error.
          </li>
          <li>
            Próximos refuerzos: moderación humana (fijar o corregir un estado, unir o separar
            historias) y mayor peso a quienes demuestran ser confiables.
          </li>
        </ul>
      </Section>
    </div>
  );
}
