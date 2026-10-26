"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money, dateTime, useAccess } from "@/lib/access";
import { statusLabels } from "@/lib/presentation";
const methodLabels:Record<string,string>={cash:"Numerário",mpesa:"M-Pesa",emola:"e-Mola",bank_transfer:"Transferência bancária",pos:"POS (histórico)"};
type Booking = {
  id: string;
  price_mzn: number;
  starts_at: string;
  status: string;
  expires_at: string;
  clients: { full_name: string } | null;
  services: { name: string } | null;
};
type Payment = {
  id: string;
  amount_mzn: number;
  validation_status: string;
  reference: string | null;
  received_at: string;
  validated_at: string | null;
  validated_by: string | null;
  registered_by: string;
  method: string;
  refunded_at: string | null;
};
export default function Payments() {
  const { role } = useAccess();
  const [bookingId, I] = useState(""),
    [booking, K] = useState<Booking | null>(null),
    [payments, P] = useState<Payment[]>([]),
    [options, O] = useState<Booking[]>([]),
    [amount, A] = useState(""),
    [method, H] = useState("mpesa"),
    [reference, F] = useState(""),
    [message, M] = useState(""),
    [busy, B] = useState(false),
    [receipt, R] = useState<Payment | null>(null),
    [loading, L] = useState(false);
  useEffect(() => {
    I(new URLSearchParams(location.search).get("booking") || "");
    supabase()
      .from("bookings")
      .select(
        "id,price_mzn,starts_at,status,expires_at,clients(full_name),services(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) M(error.message);
        else O((data || []) as unknown as Booking[]);
      });
  }, []);
  const load = useCallback(async () => {
    if (!bookingId) return;
    L(true);
    const [b, p] = await Promise.all([
      supabase()
        .from("bookings")
        .select(
          "id,price_mzn,starts_at,status,expires_at,clients(full_name),services(name)",
        )
        .eq("id", bookingId)
        .single(),
      supabase()
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("received_at"),
    ]);
    if (b.error || p.error) {
      M(b.error?.message || p.error!.message);
      K(null);
      P([]);
    } else {
      K(b.data as unknown as Booking);
      P(p.data || []);
    }
    L(false);
  }, [bookingId]);
  useEffect(() => {
    R(null);
    void load();
  }, [load]);
  async function run(
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    B(true);
    M("");
    try {
      const { error } = await fn();
      if (error) throw error;
      M("Operação concluída.");
      await load();
    } catch (e) {
      M((e as Error).message);
    } finally {
      B(false);
    }
  }
  const registered = payments
      .filter((p) => p.validation_status !== "rejected" && !p.refunded_at)
      .reduce((s, p) => s + Number(p.amount_mzn), 0),
    validated = payments
      .filter((p) => p.validation_status === "validated" && !p.refunded_at)
      .reduce((s, p) => s + Number(p.amount_mzn), 0);
  return (
    <>
      <section className="no-print">
        <h2>Registo e validação manual</h2>
        <p>
          Registar não confirma a marcação. Valide apenas depois de verificar o
          recebimento.
        </p>
        <label>
          Marcação (100 mais recentes; use a agenda para outras)
          <select value={bookingId} onChange={(e) => I(e.target.value)}>
            <option value="">Escolher marcação…</option>
            {!options.some((b) => b.id === bookingId) && bookingId && (
              <option value={bookingId}>{bookingId}</option>
            )}
            {options.map((b) => (
              <option key={b.id} value={b.id}>
                {b.clients?.full_name} · {b.services?.name} ·{" "}
                {dateTime(b.starts_at)}
              </option>
            ))}
          </select>
        </label>
        <p role="status">{message}</p>
        {loading && <p>A carregar…</p>}
        {booking && (
          <>
            <div className="grid stats">
              <div className="card">
                Devido<strong>{money(booking.price_mzn)}</strong>
              </div>
              <div className="card">
                Registado<strong>{money(registered)}</strong>
              </div>
              <div className="card">
                Validado<strong>{money(validated)}</strong>
              </div>
            </div>
            <p>
              {statusLabels[booking.status]} · Prazo:{" "}
              {dateTime(booking.expires_at)}
            </p>
            {booking.status === "pending_payment" &&
              new Date(booking.expires_at) > new Date() &&
              registered < Number(booking.price_mzn) && (
                <form
                  className="card form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() =>
                      supabase().rpc("register_payment", {
                        p_booking: bookingId,
                        p_amount: Number(amount),
                        p_method: method,
                        p_reference: reference,
                      }),
                    );
                  }}
                >
                  <label>
                    Montante recebido (MT)
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={Number(booking.price_mzn) - registered}
                      value={amount}
                      onChange={(e) => A(e.target.value)}
                    />
                  </label>
                  <label>
                    Método
                    <select value={method} onChange={(e) => H(e.target.value)}>
                      <option value="mpesa">M-Pesa</option>
                      <option value="emola">e-Mola</option>
                      <option value="cash">Numerário</option>
                      <option value="bank_transfer">
                        Transferência bancária
                      </option>
                    </select>
                  </label>
                  <label>
                    Referência manual
                    <input
                      maxLength={200}
                      value={reference}
                      onChange={(e) => F(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Registar pagamento</button>
                </form>
              )}
            <div className="stack">
              {payments.map((p) => (
                <article className="card" key={p.id}>
                  <div className="row">
                    <h3>
                      {money(p.amount_mzn)} · {methodLabels[p.method]||p.method}
                    </h3>
                    <span className="pill">
                      {p.refunded_at
                        ? "Reembolsado"
                        : {
                            pending: "Em verificação",
                            validated: "Validado",
                            rejected: "Rejeitado",
                          }[p.validation_status]}
                    </span>
                  </div>
                  <p>
                    {dateTime(p.received_at)} · Ref.: {p.reference || "—"}
                  </p>
                  <p className="muted">
                    Registado por: {p.registered_by}
                    <br />
                    Validado por: {p.validated_by || "—"} ·{" "}
                    {dateTime(p.validated_at)}
                  </p>
                  <div className="row">
                    {p.validation_status === "pending" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Confirma que verificou o recebimento deste montante?",
                              )
                            )
                              void run(() =>
                                supabase().rpc("validate_payment", {
                                  p_payment: p.id,
                                  p_approve: true,
                                }),
                              );
                          }}
                        >
                          Validar recebimento
                        </button>
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (confirm("Rejeitar este registo?"))
                              void run(() =>
                                supabase().rpc("validate_payment", {
                                  p_payment: p.id,
                                  p_approve: false,
                                }),
                              );
                          }}
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                    {p.validation_status === "validated" && (
                      <button className="ghost" onClick={() => R(p)}>
                        Abrir recibo
                      </button>
                    )}
                    {role === "manager" &&
                      p.validation_status === "validated" &&
                      !p.refunded_at &&
                      (["cancelled", "expired"].includes(booking.status)||(booking.status==="pending_payment"&&new Date(booking.expires_at)<=new Date())) && (
                        <button
                          disabled={busy}
                          className="ghost"
                          onClick={() => {
                            const reason = prompt(
                              "Motivo e decisão do reembolso integral já efectuado:",
                            );
                            if (reason)
                              void run(() =>
                                supabase().rpc("refund_payment", {
                                  p_payment: p.id,
                                  p_reason: reason,
                                }),
                              );
                          }}
                        >
                          Registar reembolso
                        </button>
                      )}
                  </div>
                </article>
              ))}
              {!payments.length && <p>Sem pagamentos registados.</p>}
            </div>
          </>
        )}
      </section>
      {receipt && booking && (
        <article className="card receipt">
          <div className="row">
            <h2>InfoSalão · Recibo</h2>
            <button className="no-print" onClick={() => window.print()}>
              Imprimir recibo
            </button>
          </div>
          <p>N.º {receipt.id}</p>
          <p>Cliente: {booking.clients?.full_name}</p>
          <p>
            Serviço: {booking.services?.name} · {dateTime(booking.starts_at)}
          </p>
          <p>Recebido em: {dateTime(receipt.received_at)}</p>
          <p>
            Método: {methodLabels[receipt.method]||receipt.method} · Referência: {receipt.reference || "—"}
          </p>
          <h3>{money(receipt.amount_mzn)}</h3>
          <p>Validado em {dateTime(receipt.validated_at)}</p>
          <p>
            {receipt.refunded_at
              ? `Reembolsado em ${dateTime(receipt.refunded_at)}`
              : "Comprovativo interno de pagamento validado."}
          </p>
        </article>
      )}
    </>
  );
}
