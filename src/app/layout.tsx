import type { Metadata } from "next";
import Navigation from "@/components/navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "InfoSalão · Beleza & cuidado",
  description:
    "Reserve o seu momento de cuidado. Serviços, profissionais e marcações num só lugar.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-MZ">
      <body>
        <a className="skip" href="#conteudo">
          Saltar para o conteúdo
        </a>
        <Navigation />
        <main id="conteudo" className="shell">
          {children}
        </main>
        <footer className="shell footer">
          <span className="brand">✦ InfoSalão</span>
          <span>O seu tempo. O seu cuidado.</span>
          <span>Maputo · Moçambique</span>
        </footer>
      </body>
    </html>
  );
}
