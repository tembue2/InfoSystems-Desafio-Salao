"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icon";
export default function Navigation() {
  const path = usePathname();
  const workspace = ["/reservar", "/minhas-marcacoes", "/admin"].includes(path);
  return (
    <header className={`header ${workspace ? "workspace-nav" : ""}`}>
      <div className="shell nav">
        <Link className="brand" href="/" aria-label="InfoSalão — início">
          <span className="brand-symbol">
            <Icon name="spark" size={25} />
          </span>
          <span>
            info<span className="brand-light">salão</span>
            <small>O SEU ESPAÇO DE CUIDADO</small>
          </span>
        </Link>
        {workspace && <div className="nav-section">ESPAÇO INFOSALÃO</div>}
        <nav aria-label="Navegação principal">
          {[
            ["/", "Início", "home"],
            ["/reservar", "Nova marcação", "calendar"],
            ["/minhas-marcacoes", "Minhas marcações", "clock"],
            ["/admin", "Gestão", "grid"],
          ].map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon name={icon} size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="button ghost account-link" href="/entrar">
          <Icon name="user" size={18} /> Minha conta
        </Link>
        {workspace && (
          <div className="sidebar-note">
            <Icon name="spark" />
            <p>
              Um espaço para cuidar
              <br />
              do seu tempo.
            </p>
            <span>Maputo, Moçambique</span>
          </div>
        )}
      </div>
    </header>
  );
}
