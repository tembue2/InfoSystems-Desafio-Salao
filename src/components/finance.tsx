"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { bounds, today, money, dateTime } from "@/lib/access";
import DataManager, { Field } from "./data-manager";
const fields: Field[] = [
  { key: "description", label: "Descrição / origem", required: true },
  {
    key: "amount_mzn",
    label: "Valor (MT)",
    type: "number",
    min: 0.01,
    step: "0.01",
    required: true,
  },
  {
    key: "occurred_at",
    label: "Data (Maputo)",
    type: "datetime-local",
    required: true,
  },
];
export default function Finance() {
  const [from, F] = useState(today().slice(0, 7) + "-01"),
    [to, T] = useState(today()),
    [summary, S] = useState<Record<string, number> | null>(null),
    [msg, M] = useState(""),
    [kind, K] = useState("expenses"),
    [rows, R] = useState<
      {
        id: string;
        description: string;
        amount_mzn: number;
        occurred_at: string;
        source: string;
      }[]
    >([]);
  const load = useCallback(async () => {
    try {
      const [a, b] = bounds(from, to);
      if (a >= b) throw new Error("Intervalo de datas inválido.");
      const { data, error } = await supabase().rpc("finance_summary", {
        p_from: a,
        p_to: b,
      });
      if (error) throw error;
      S(data);
      const results = await Promise.all([
        supabase()
          .from("payments")
          .select("id,amount_mzn,received_at,booking_id")
          .eq("validation_status", "validated")
          .gte("received_at", a)
          .lt("received_at", b)
          .order("received_at", { ascending: false })
          .limit(200),
        supabase()
          .from("expenses")
          .select("*")
          .gte("occurred_at", a)
          .lt("occurred_at", b)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase()
          .from("manual_income")
          .select("*")
          .gte("occurred_at", a)
          .lt("occurred_at", b)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase()
          .from("payments")
          .select("id,amount_mzn,refunded_at,booking_id")
          .eq("validation_status", "validated")
          .gte("refunded_at", a)
          .lt("refunded_at", b)
          .order("refunded_at", { ascending: false })
          .limit(200),
      ]);
      for (const r of results) if (r.error) throw r.error;
      R(
        [
          ...results[0].data!.map((p) => ({
            id: p.id,
            description: `Marcação ${p.booking_id}`,
            amount_mzn: p.amount_mzn,
            occurred_at: p.received_at,
            source: "Pagamento validado",
          })),
          ...results[1].data!.map((p) => ({ ...p, source: "Despesa" })),
          ...results[2].data!.map((p) => ({ ...p, source: "Outra receita" })),
          ...results[3].data!.map((p) => ({
            id: p.id,
            description: `Reembolso da marcação ${p.booking_id}`,
            amount_mzn: p.amount_mzn,
            occurred_at: p.refunded_at,
            source: "Reembolso",
          })),
        ].sort((x, y) => y.occurred_at.localeCompare(x.occurred_at)),
      );
      M("");
    } catch (e) {
      M((e as Error).message);
    }
  }, [from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  const values = summary
    ? ([
        ["Pagamentos validados", summary.receipts],
        ["Outras receitas", summary.other],
        ["Reembolsos", summary.refunds],
        ["Despesas", summary.expenses],
        [
          "Saldo",
          Number(summary.receipts) +
            Number(summary.other) -
            Number(summary.expenses) -
            Number(summary.refunds),
        ],
      ] as const)
    : [];
  return (
    <>
      <div className="toolbar">
        <label>
          De
          <input
            type="date"
            required
            value={from}
            onChange={(e) => e.target.value && F(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            required
            value={to}
            onChange={(e) => e.target.value && T(e.target.value)}
          />
        </label>
        <button
          className="ghost"
          onClick={() => {
            F(today());
            T(today());
          }}
        >
          Hoje
        </button>
        <button
          className="ghost"
          onClick={() => {
            F(today().slice(0, 7) + "-01");
            T(today());
          }}
        >
          Este mês
        </button>
        <button onClick={() => void load()}>Actualizar resumos</button>
      </div>
      <p role="status">{msg}</p>
      <div className="grid stats">
        {values.map(([k, v]) => (
          <div className="card" key={k}>
            <span>{k}</span>
            <strong>{money(v)}</strong>
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Composição do período</h2>
        {values.slice(0, 4).map(([label, v]) => (
          <div className="finance-bar" key={label}>
            <span>{label}</span>
            <meter
              min={0}
              max={Math.max(1, ...values.slice(0, 4).map(([, n]) => Number(n)))}
              value={Number(v)}
              aria-label={label}
            />
            <span>{money(v)}</span>
          </div>
        ))}
      </section>
      <p className="notice">
        Pagamentos validados são contabilizados automaticamente. Não os registe
        novamente em outras receitas. Valores agregados abrangem todo o período;
        a lista mostra até 200 movimentos por origem.
      </p>
      <div className="toolbar">
        <button
          className={kind === "expenses" ? "" : "ghost"}
          onClick={() => K("expenses")}
        >
          Despesas
        </button>
        <button
          className={kind === "manual_income" ? "" : "ghost"}
          onClick={() => K("manual_income")}
        >
          Outras receitas
        </button>
      </div>
      <DataManager
        key={kind}
        title={
          kind === "expenses" ? "Despesas" : "Outras receitas (sem marcações)"
        }
        table={kind}
        allowUpdate={false}
        fields={fields}
        order="occurred_at"
      />
      <section className="card tablewrap">
        <h2>Histórico do período</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Origem</th>
              <th>Descrição</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td>{dateTime(r.occurred_at)}</td>
                <td>{r.source}</td>
                <td>{r.description}</td>
                <td>{money(r.amount_mzn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>Sem movimentos neste período.</p>}
      </section>
    </>
  );
}
