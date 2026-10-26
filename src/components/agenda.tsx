"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAccess, dateTime, money, today, bounds } from "@/lib/access";
import { statusLabels } from "@/lib/presentation";
import Link from "next/link";
export type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  price_mzn: number;
  status: string;
  expires_at: string;
  clients: { full_name: string; phone: string } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
  payments: {
    id: string;
    amount_mzn: number;
    validation_status: string;
    refunded_at: string | null;
  }[];
};
export function visibleStatus(b: Booking) {
  if (b.status === "pending_payment") {
    if (new Date(b.expires_at) <= new Date()) return "expired";
    if (b.payments.some((p) => p.validation_status === "pending"))
      return "payment_review";
  }
  return b.status;
}
export default function Agenda() {
  const { role } = useAccess();
  const [day, D] = useState(today()),
    [rows, R] = useState<Booking[]>([]),
    [status, S] = useState(""),
    [search, Q] = useState(""),
    [message, M] = useState(""),
    [loading, L] = useState(true),
    [busy, B] = useState("");
  const manage = role === "manager" || role === "reception";
  const load = useCallback(async () => {
    L(true);
    const [from, to] = bounds(day, day);
    const { data, error } = await supabase()
      .from("bookings")
      .select(
        "id,starts_at,ends_at,price_mzn,status,expires_at,clients(full_name,phone),services(name),professionals(display_name),payments(id,amount_mzn,validation_status,refunded_at)",
      )
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    if (error) M(error.message);
    else R((data || []) as unknown as Booking[]);
    L(false);
  }, [day]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(b: Booking, next: string) {
    if (
      next === "cancelled" &&
      !confirm(
        "Cancelar a marcação? Eventuais reembolsos são avaliados separadamente pela gerência.",
      )
    )
      return;
    B(b.id);
    try {
      const { error } = await supabase().rpc(
        next === "cancelled" ? "cancel_booking" : "set_booking_status",
        next === "cancelled"
          ? { p_booking: b.id }
          : { p_booking: b.id, p_status: next },
      );
      if (error) throw error;
      M("Estado actualizado.");
      await load();
    } catch (e) {
      M((e as Error).message);
    } finally {
      B("");
    }
  }
  const filtered = rows.filter(
    (b) =>
      (!status || visibleStatus(b) === status) &&
      `${b.clients?.full_name} ${b.services?.name} ${b.professionals?.display_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="row">
        <h2>Agenda do dia</h2>
        {manage && (
          <Link className="button" href="/admin/nova-marcacao">
            Nova marcação
          </Link>
        )}
      </div>
      <div className="toolbar">
        <label>
          Data (Maputo)
          <input
            type="date"
            required
            value={day}
            onChange={(e) => e.target.value && D(e.target.value)}
          />
        </label>
        <input
          aria-label="Pesquisar agenda"
          placeholder="Cliente, serviço ou profissional…"
          value={search}
          onChange={(e) => Q(e.target.value)}
        />
        <select
          aria-label="Estado"
          value={status}
          onChange={(e) => S(e.target.value)}
        >
          <option value="">Todos os estados</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="ghost" onClick={() => void load()}>
          Actualizar
        </button>
      </div>
      <p role="status">{message}</p>
      {loading ? (
        <p>A carregar agenda…</p>
      ) : (
        <div className="stack">
          {filtered.map((b) => (
            <article className="card" key={b.id}>
              <div className="row">
                <div>
                  <div className="eyebrow">{dateTime(b.starts_at)}</div>
                  <h3>
                    {b.clients?.full_name || "Cliente"} · {b.services?.name}
                  </h3>
                  <p>
                    {b.professionals?.display_name} · até {dateTime(b.ends_at)}{" "}
                    {manage && `· ${money(b.price_mzn)}`}
                  </p>
                </div>
                <span className="pill">{statusLabels[visibleStatus(b)]}</span>
              </div>
              <div className="row">
                {b.status === "confirmed" && (
                  <button
                    disabled={busy === b.id}
                    onClick={() => void action(b, "in_progress")}
                  >
                    Iniciar atendimento
                  </button>
                )}
                {b.status === "in_progress" && (
                  <button
                    disabled={busy === b.id}
                    onClick={() => void action(b, "completed")}
                  >
                    Concluir atendimento
                  </button>
                )}
                {manage &&
                  ["pending_payment", "confirmed"].includes(b.status) && (
                    <button
                      className="ghost"
                      disabled={busy === b.id}
                      onClick={() => void action(b, "cancelled")}
                    >
                      Cancelar
                    </button>
                  )}
                {manage && (
                  <Link href={`/admin/pagamentos?booking=${b.id}`}>
                    Pagamentos e recibos
                  </Link>
                )}
              </div>
            </article>
          ))}
          {!filtered.length && (
            <div className="empty">Sem marcações para esta data e filtros.</div>
          )}
        </div>
      )}
    </>
  );
}
