"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { statusLabels, roleLabels } from "@/lib/presentation";
type B = {
  id: string;
  starts_at: string;
  price_mzn: number;
  status: string;
  expires_at: string;
  profiles: { full_name: string; phone: string } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
export default function Admin() {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [role, setRole] = useState(""),
    [rows, setRows] = useState<B[]>([]),
    [method, setMethod] = useState("mpesa"),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const {
      data: { user },
    } = await supabase().auth.getUser();
    if (!user) {
      setMessage("Inicie sessão com uma conta da equipa.");
      return;
    }
    const { data: p, error: pe } = await supabase()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (pe) throw pe;
    setRole(p.role);
    if (!["manager", "reception", "professional"].includes(p.role)) return;
    const { data, error } = await supabase()
      .from("bookings")
      .select(
        "id,starts_at,price_mzn,status,expires_at,profiles!customer_id(full_name,phone),services(name),professionals(display_name)",
      )
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    setRows((data as unknown as B[]) || []);
  }
  useEffect(() => {
    load().catch((e) => setMessage((e as Error).message));
  }, []);
  async function confirm(id: string) {
    if (
      !window.confirm(
        "Confirma que o pagamento integral foi efectivamente recebido e validado?",
      )
    )
      return;
    setBusy(id);
    const { error } = await supabase().rpc("confirm_booking_payment", {
      p_booking: id,
      p_method: method,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Pagamento registado e marcação confirmada.");
      await load();
    }
    setBusy("");
  }
  const filtered = rows.filter(
    (b) =>
      (!status || b.status === status) &&
      [b.profiles?.full_name, b.services?.name, b.professionals?.display_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Área interna</div>
        <h1>
          {role === "professional"
            ? "A minha agenda"
            : "O salão, num só olhar."}
        </h1>
        <p>
          Registe pagamentos apenas após verificar o recebimento real do valor.
          Este painel não processa pagamentos online.
        </p>
      </div>
      {role && <div className="notice">Perfil: {roleLabels[role] || role}</div>}
      {["manager", "reception", "professional"].includes(role) && (
        <div className="grid stats" style={{ marginTop: 24 }}>
          {[
            ["Marcações carregadas", rows.length],
            [
              "Confirmadas",
              rows.filter((b) => b.status === "confirmed").length,
            ],
            [
              "Pagamento pendente",
              rows.filter((b) => b.status === "pending_payment").length,
            ],
          ].map(([label, value]) => (
            <div className="card" key={label}>
              <div className="muted">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}
      {["manager", "reception"].includes(role) && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 400 }}>
          <label>
            Método do pagamento recebido
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="cash">Numerário</option>
              <option value="bank_transfer">Transferência bancária</option>
              <option value="pos">POS</option>
            </select>
          </label>
        </div>
      )}
      <div className="toolbar">
        <input
          aria-label="Pesquisar marcações"
          placeholder="Pesquisar cliente, serviço ou profissional…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os estados</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        Últimas 100 marcações acessíveis ao seu perfil · {filtered.length}{" "}
        resultado(s)
      </p>
      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cliente / serviço</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Acção</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.profiles?.full_name || "Cliente"}
                  <br />
                  <span className="muted">
                    {b.services?.name} · {b.professionals?.display_name}
                  </span>
                </td>
                <td>
                  {new Date(b.starts_at).toLocaleString("pt-PT", {
                    timeZone: "Africa/Maputo",
                  })}
                </td>
                <td>{Number(b.price_mzn).toFixed(2)} MZN</td>
                <td>
                  <span className={`pill status-${b.status}`}>
                    {statusLabels[b.status] || b.status}
                  </span>
                </td>
                <td>
                  {b.status === "pending_payment" &&
                  ["manager", "reception"].includes(role) ? (
                    <button
                      disabled={
                        busy === b.id || new Date(b.expires_at) <= new Date()
                      }
                      onClick={() => confirm(b.id)}
                    >
                      Validar pagamento
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5}>
                  Não existem marcações para apresentar com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!role && (
        <p>Área exclusiva da equipa. Necessita de perfil autorizado.</p>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
    </>
  );
}
