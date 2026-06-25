import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "VerificaVE — Verificación ciudadana tras el terremoto",
    template: "%s · VerificaVE",
  },
  description:
    "Plataforma colaborativa para verificar información tras el terremoto en Venezuela. Reúne reportes de varias fuentes, elimina duplicados y deja que la comunidad confirme qué es cierto.",
  applicationName: "VerificaVE",
  openGraph: {
    title: "VerificaVE",
    description:
      "Información verificada por la comunidad tras el terremoto en Venezuela.",
    locale: "es_VE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
