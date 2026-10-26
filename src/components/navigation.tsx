"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/lib/access";
import Icon from "./icon";
export default function Navigation() {
  const path = usePathname();
  const { role } = useAccess();
  const staff = role && role !== "customer";
  const manager = role === "manager";
  const reception = manager || role === "reception";
  const workspace =
    path.startsWith("/admin") ||
    ["/reservar", "/minhas-marcacoes", "/perfil"].includes(path);
  const links = [
    ["/", "Início", "home"],
    ["/catalogo", "Serviços", "spark"],
    ...(staff
      ? [
          ["/admin", "Painel", "grid"],
          ["/admin/agenda", "Agenda", "calendar"],
        ]
      : [
          ["/reservar", "Nova marcação", "calendar"],
          ["/minhas-marcacoes", "Minhas marcações", "clock"],
        ]),
    ...(reception
      ? [
          ["/admin/clientes", "Clientes", "user"],
          ["/admin/pagamentos", "Pagamentos", "grid"],
        ]
      : []),
    ...(manager
      ? [
          ["/admin/servicos", "Gerir serviços", "spark"],
          ["/admin/profissionais", "Profissionais", "user"],
          ["/admin/horarios", "Horários", "clock"],
          ["/admin/financas", "Finanças", "grid"],
          ["/admin/inventario", "Inventário", "grid"],
          ["/admin/definicoes", "Definições", "grid"],
        ]
      : role === "professional"
        ? [["/admin/horarios", "Meus horários", "clock"]]
        : []),
  ];
  return (
    <header className={`header ${workspace ? "workspace-nav" : ""}`}>
      <div className="shell nav">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Icon name="spark" size={25} />
          </span>
          <span>
            info<span className="brand-light">salão</span>
            <small>O SEU ESPAÇO DE CUIDADO</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          {links.map(([href, label, icon]) => (
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
        <Link
          className="button ghost account-link"
          href={role ? "/perfil" : "/entrar"}
        >
          <Icon name="user" size={18} />
          {role ? "Minha conta" : "Entrar"}
        </Link>
      </div>
    </header>
  );
}
