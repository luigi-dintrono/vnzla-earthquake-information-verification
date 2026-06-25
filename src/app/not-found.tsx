import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-3xl" aria-hidden>
        🔎
      </p>
      <h1 className="mt-2 text-lg font-bold">No encontramos eso</h1>
      <p className="mt-1 text-sm text-muted-foreground">El reporte no existe o fue retirado.</p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-[color:var(--primary-foreground)]"
        style={{ backgroundColor: "var(--primary)" }}
      >
        Volver al feed
      </Link>
    </div>
  );
}
