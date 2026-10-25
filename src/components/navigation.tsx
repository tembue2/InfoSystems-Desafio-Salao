"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function Navigation() {
  const path = usePathname();
  return (
    <header className="header">
      <div className="shell nav">
        <Link className="brand" href="/" aria-label="InfoSalão — início">
          <span className="brand-symbol">✦</span>
          <span>
            Info<span className="brand-light">Salão</span>
            <small>BELEZA & CUIDADO</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          {[
            ["/", "Início"],
            ["/reservar", "Reservar"],
            ["/minhas-marcacoes", "Minhas marcações"],
            ["/admin", "Gestão"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className="button ghost account-link" href="/entrar">
          Minha conta <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
