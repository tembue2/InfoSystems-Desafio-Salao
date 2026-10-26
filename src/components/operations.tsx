"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAccess, money, dateTime } from "@/lib/access";
import DataManager, { Field, Row } from "./data-manager";
const serviceFields: Field[] = [
  { key: "name", label: "Nome", required: true },
  { key: "description", label: "Descrição", type: "textarea" },
  {
    key: "price_mzn",
    label: "Preço (MT)",
    type: "number",
    min: 0.01,
    step: "0.01",
    required: true,
  },
  {
    key: "duration_minutes",
    label: "Duração (min)",
    type: "number",
    min: 15,
    max: 480,
    required: true,
  },
  { key: "active", label: "Activo", type: "checkbox" },
];
const clientFields: Field[] = [
  { key: "full_name", label: "Nome completo", required: true },
  { key: "phone", label: "Telemóvel" },
  { key: "email", label: "E-mail", type: "email" },
];
const productFields: Field[] = [
  { key: "name", label: "Nome", required: true },
  {
    key: "kind",
    label: "Tipo",
    type: "select",
    required: true,
    options: [
      { value: "sale", label: "Para venda" },
      { value: "consumable", label: "Material de consumo" },
    ],
  },
  {
    key: "sale_price_mzn",
    label: "Preço (MT)",
    type: "number",
    min: 0,
    step: "0.01",
  },
  {
    key: "min_quantity",
    label: "Limite de stock baixo",
    type: "number",
    min: 0,
    required: true,
  },
  { key: "active", label: "Activo", type: "checkbox" },
];
export function Services() {
  return (
    <DataManager
      title="Serviços"
      table="services"
      order="name"
      fields={serviceFields}
    />
  );
}
export function Clients() {
  const [client, C] = useState<Row | null>(null),
    [history, H] = useState<
      {
        id: string;
        starts_at: string;
        status: string;
        price_mzn: number;
        payments: { amount_mzn: number; validation_status: string }[];
      }[]
    >([]),
    [error, E] = useState("");
  async function select(c: Row) {
    C(c);
    const { data, error } = await supabase()
      .from("bookings")
      .select(
        "id,starts_at,status,price_mzn,payments(amount_mzn,validation_status)",
      )
      .eq("client_id", c.id)
      .order("starts_at", { ascending: false });
    if (error) E(error.message);
    else H(data || []);
  }
  return (
    <>
      <DataManager
        title="Clientes"
        table="clients"
        fields={clientFields}
        order="full_name"
        onSelect={select}
      />
      {client && (
        <section className="card">
          <h2>Histórico · {client.full_name}</h2>
          <p role="alert">{error}</p>
          {history.length ? (
            history.map((b) => (
              <p key={b.id}>
                {dateTime(b.starts_at)} ·{" "}
                {new Date(b.starts_at) > new Date() ? "Futura · " : ""}
                {b.status} · {money(b.price_mzn)} · Validado:{" "}
                {money(
                  b.payments
                    .filter((p) => p.validation_status === "validated")
                    .reduce((n, p) => n + Number(p.amount_mzn), 0),
                )}
              </p>
            ))
          ) : (
            <p>Sem marcações.</p>
          )}
        </section>
      )}
    </>
  );
}
export function Professionals() {
  const [profiles, P] = useState<Row[]>([]),
    [services, S] = useState<Row[]>([]),
    [selected, C] = useState<Row | null>(null),
    [assigned, A] = useState<string[]>([]),
    [msg, M] = useState(""),
    [busy, B] = useState(false);
  useEffect(() => {
    Promise.all([
      supabase()
        .from("profiles")
        .select("id,full_name")
        .eq("role", "professional"),
      supabase().from("services").select("id,name"),
    ]).then(([p, s]) => {
      if (p.error || s.error) M(p.error?.message || s.error!.message);
      P(p.data || []);
      S(s.data || []);
    });
  }, []);
  const fields = useMemo<Field[]>(
    () => [
      { key: "display_name", label: "Nome profissional", required: true },
      {
        key: "profile_id",
        label: "Conta de profissional",
        type: "select",
        options: profiles.map((p) => ({
          value: String(p.id),
          label: String(p.full_name),
        })),
      },
      { key: "active", label: "Activo", type: "checkbox" },
    ],
    [profiles],
  );
  async function select(p: Row) {
    C(p);
    const { data, error } = await supabase()
      .from("professional_services")
      .select("service_id")
      .eq("professional_id", p.id);
    if (error) M(error.message);
    else A((data || []).map((r) => r.service_id));
  }
  async function toggle(id: string, checked: boolean) {
    if (!selected) return;
    B(true);
    const { error } = checked
      ? await supabase()
          .from("professional_services")
          .insert({ professional_id: selected.id, service_id: id })
      : await supabase()
          .from("professional_services")
          .delete()
          .eq("professional_id", selected.id)
          .eq("service_id", id);
    if (error) M(error.message);
    else {
      A(checked ? [...assigned, id] : assigned.filter((x) => x !== id));
      M("Associação actualizada.");
    }
    B(false);
  }
  return (
    <>
      <DataManager
        title="Profissionais"
        table="professionals"
        fields={fields}
        order="display_name"
        onSelect={select}
      />
      <p className="notice">
        Associe uma conta com perfil Profissional. Novos profissionais precisam
        de horários configurados antes de receber marcações.
      </p>
      {selected && (
        <section className="card">
          <h2>Serviços de {selected.display_name}</h2>
          {services.map((s) => (
            <label className="check-row" key={String(s.id)}>
              <input
                type="checkbox"
                disabled={busy}
                checked={assigned.includes(String(s.id))}
                onChange={(e) => void toggle(String(s.id), e.target.checked)}
              />
              {s.name}
            </label>
          ))}
        </section>
      )}
      <p role="status">{msg}</p>
    </>
  );
}
export function Inventory() {
  const [selected, C] = useState<Row | null>(null),
    [delta, D] = useState(1),
    [reason, R] = useState(""),
    [moves, V] = useState<Row[]>([]),
    [msg, M] = useState(""),
    [busy, B] = useState(false),
    [version, K] = useState(0);
  async function select(p: Row) {
    C(p);
    const { data, error } = await supabase()
      .from("stock_movements")
      .select("*")
      .eq("product_id", p.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) M(error.message);
    else V(data || []);
  }
  async function move(e: React.FormEvent) {
    e.preventDefault();
    B(true);
    try {
      const { data, error } = await supabase().rpc("adjust_stock", {
        p_product: selected!.id,
        p_delta: delta,
        p_reason: reason,
      });
      if (error) throw error;
      M(`Movimento registado. Stock: ${data}.`);
      K(version + 1);
      await select({ ...selected!, quantity: data });
      R("");
    } catch (e) {
      M((e as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <DataManager
        key={version}
        title="Produtos e materiais"
        table="products"
        fields={productFields}
        columns={["name", "kind", "quantity", "min_quantity", "active"]}
        order="name"
        onSelect={select}
      />
      {selected && (
        <section className="card">
          <h2>{selected.name}</h2>
          <p
            className={
              Number(selected.quantity) <= Number(selected.min_quantity)
                ? "notice"
                : ""
            }
          >
            Stock: {selected.quantity} ·{" "}
            {Number(selected.quantity) <= Number(selected.min_quantity)
              ? "Stock baixo"
              : "Disponível"}
          </p>
          <form className="form-grid" onSubmit={move}>
            <label>
              Quantidade (+ entrada / − saída)
              <input
                type="number"
                required
                step="1"
                value={delta}
                onChange={(e) => D(Number(e.target.value))}
              />
            </label>
            <label>
              Motivo (compra, venda ou consumo)
              <input
                required
                value={reason}
                onChange={(e) => R(e.target.value)}
              />
            </label>
            <button disabled={busy || !delta}>Registar movimento</button>
          </form>
          <h3>Últimos 100 movimentos</h3>
          {moves.map((m) => (
            <p key={String(m.id)}>
              {dateTime(m.created_at)} · {m.delta} · {m.reason}
            </p>
          ))}
        </section>
      )}
      <p role="status">{msg}</p>
    </>
  );
}
export function Hours() {
  const { role, id } = useAccess();
  const [professionals, P] = useState<Row[]>([]),
    [msg, M] = useState("");
  useEffect(() => {
    supabase()
      .from("professionals")
      .select("id,display_name,profile_id")
      .then(({ data, error }) => {
        if (error) M(error.message);
        else
          P(
            (data || []).filter(
              (p) => role !== "professional" || p.profile_id === id,
            ),
          );
      });
  }, [role, id]);
  const options = useMemo(
    () =>
      professionals.map((p) => ({
        value: String(p.id),
        label: String(p.display_name),
      })),
    [professionals],
  );
  const fields = useMemo<Field[]>(
    () => [
      {
        key: "professional_id",
        label: "Profissional",
        type: "select",
        options,
        required: true,
      },
      {
        key: "weekday",
        label: "Dia",
        type: "select",
        required: true,
        options: [
          "Segunda",
          "Terça",
          "Quarta",
          "Quinta",
          "Sexta",
          "Sábado",
          "Domingo",
        ].map((label, i) => ({ value: String(i + 1), label })),
      },
      { key: "opens", label: "Entrada", type: "time", required: true },
      { key: "closes", label: "Saída", type: "time", required: true },
    ],
    [options],
  );
  const offFields = useMemo<Field[]>(
    () => [
      {
        key: "professional_id",
        label: "Profissional",
        type: "select",
        options,
        required: true,
      },
      {
        key: "starts_at",
        label: "Início (Maputo)",
        type: "datetime-local",
        required: true,
      },
      {
        key: "ends_at",
        label: "Fim (Maputo)",
        type: "datetime-local",
        required: true,
      },
      { key: "reason", label: "Motivo", required: true },
    ],
    [options],
  );
  if (!role || (role === "professional" && !professionals.length))
    return <p>Sem profissional associado. {msg}</p>;
  return (
    <>
      <p className="notice">
        Horários em Maputo. As indisponibilidades bloqueiam novas reservas.
        Marcações existentes precisam de ser reagendadas ou canceladas pela
        recepção.
      </p>
      <DataManager
        title="Horários semanais"
        table="work_hours"
        allowDelete
        fields={fields}
        canEdit={role === "manager"}
        filter={
          role === "professional"
            ? ["professional_id", String(professionals[0].id)]
            : undefined
        }
      />
      <DataManager
        title="Indisponibilidades"
        table="time_off"
        allowDelete
        fields={offFields}
        canEdit={role === "manager"}
        filter={
          role === "professional"
            ? ["professional_id", String(professionals[0].id)]
            : undefined
        }
      />
      <p role="status">{msg}</p>
    </>
  );
}
const settingsFields: Field[] = [
  {
    key: "hold_minutes",
    label: "Prazo de pré-reserva (minutos)",
    type: "number",
    min: 5,
    max: 1440,
    required: true,
  },
  {
    key: "policy_text",
    label: "Condições de cancelamento e reembolso",
    type: "textarea",
    required: true,
  },
  {
    key: "policy_approved",
    label: "Política aprovada pela gerência",
    type: "checkbox",
  },
];
export function Settings() {
  return (
    <>
      <p className="notice">
        A alteração do prazo aplica-se apenas a novas reservas. A política deve
        ser aprovada pela gerência antes de ser apresentada como definitiva.
      </p>
      <DataManager
        title="Políticas operacionais"
        table="salon_settings"
        allowCreate={false}
        fields={settingsFields}
      />
      <Audit />
    </>
  );
}
function Audit() {
  const [rows, R] = useState<Row[]>([]),
    [error, E] = useState("");
  useEffect(() => {
    supabase()
      .from("audit_events")
      .select("id,entity,record_id,action,actor_id,created_at")
      .order("id", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) E(error.message);
        else R(data || []);
      });
  }, []);
  return (
    <section className="card">
      <h2>Últimas 50 alterações</h2>
      <p role="alert">{error}</p>
      {rows.map((r) => (
        <p key={String(r.id)}>
          {dateTime(r.created_at)} · {r.entity} · {r.action} ·{" "}
          {r.actor_id || "Sistema"}
        </p>
      ))}
    </section>
  );
}
