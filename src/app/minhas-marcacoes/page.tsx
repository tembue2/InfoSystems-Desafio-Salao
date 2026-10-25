"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { statusLabels } from "@/lib/presentation";
type B = {
  id: string;
  starts_at: string;
  price_mzn: number;
  status: string;
  refund_due: boolean;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
export default function MinhasMarcacoes() {
  const [rows, setRows] = useState<B[]>([]),
    [message, setMessage] = useState(""),
    [logged, setLogged] = useState<boolean | null>(null);
  async function load() {
    const {
      data: { user },
    } = await supabase().auth.getUser();
    setLogged(Boolean(user));
    if (!user) return;
    const { data, error } = await supabase()
      .from("bookings")
      .select(
        "id,starts_at,price_mzn,status,refund_due,services(name),professionals(display_name)",
      )
      .eq("customer_id", user.id)
      .order("starts_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRows((data as unknown as B[]) || []);
  }
  useEffect(() => {
    load().catch((e) => setMessage((e as Error).message));
  }, []);
  async function cancel(id: string) {
    if (!window.confirm("Pretende pedir o cancelamento desta marcação?"))
      return;
    const { error } = await supabase().rpc("cancel_booking", { p_booking: id });
    if (error) setMessage(error.message);
    else {
      setMessage(
        "Marcação cancelada. Se houver reembolso devido, a gerência irá tratá-lo manualmente.",
      );
      await load();
    }
  }
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Clientes</div>
        <h1>Minhas marcações</h1>
        <p>
          A pré-reserva não está confirmada até a equipa validar o pagamento
          integral.
        </p>
      </div>
      {logged === false && (
        <p>
          <Link href="/entrar">Entre na sua conta</Link> para consultar as
          marcações.
        </p>
      )}
      {rows.length === 0 && logged && (
        <div className="empty">
          <div className="eyebrow">O SEU PRÓXIMO MOMENTO</div>
          <h2>A sua agenda começa aqui.</h2>
          <p>
            Ainda não tem marcações. Escolha um serviço para preparar a sua
            primeira visita.
          </p>
          <Link className="button" href="/reservar">
            Marcar um serviço ↗
          </Link>
        </div>
      )}
      <div className="stack">
        {rows.map((b) => (
          <article className="card" key={b.id}>
            <div className="row">
              <div>
                <strong>{b.services?.name || "Serviço"}</strong>
                <p className="muted">
                  {b.professionals?.display_name} ·{" "}
                  {new Date(b.starts_at).toLocaleString("pt-PT", {
                    timeZone: "Africa/Maputo",
                  })}{" "}
                  (Maputo)
                </p>
                <p className="muted">
                  Valor: {Number(b.price_mzn).toFixed(2)} MZN
                </p>
              </div>
              <span className={`pill status-${b.status}`}>
                {statusLabels[b.status] || b.status}
              </span>
            </div>
            {b.refund_due && (
              <p className="notice">
                Reembolso elegível: aguarda processamento manual.
              </p>
            )}
            {["pending_payment", "confirmed"].includes(b.status) && (
              <button className="button ghost" onClick={() => cancel(b.id)}>
                Cancelar
              </button>
            )}
          </article>
        ))}
      </div>
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
    </>
  );
}
