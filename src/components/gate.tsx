"use client";
import Link from "next/link";
import { useAccess, Role } from "@/lib/access";
export default function Gate({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { role, loading, error } = useAccess();
  if (loading) return <p role="status">A carregar a sua sessão…</p>;
  if (error)
    return (
      <p role="alert" className="notice">
        {error}
      </p>
    );
  if (!role)
    return (
      <div className="empty">
        <h1>Inicie sessão</h1>
        <Link className="button" href="/entrar">
          Entrar na conta
        </Link>
      </div>
    );
  if (!roles.includes(role))
    return (
      <div className="empty">
        <h1>Acesso não autorizado</h1>
        <p>Esta área não está disponível para o seu perfil.</p>
        <Link href="/">Voltar ao início</Link>
      </div>
    );
  return <>{children}</>;
}
