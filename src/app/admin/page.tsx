"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAccess, today, bounds, money } from "@/lib/access";
import Agenda from "@/components/agenda";
export default function Dashboard() {
  const { role } = useAccess();
  const [stats, S] = useState<{ label: string; value: string | number }[]>([]),
    [message, M] = useState("");
  useEffect(() => {
    if (!role) return;
    (async () => {
      const [a, b] = bounds(today(), today());
      const queries = await Promise.all([
        supabase()
          .from("bookings")
          .select("id", { head: true, count: "exact" })
          .gte("starts_at", a)
          .lt("starts_at", b),
        supabase()
          .from("bookings")
          .select("id", { head: true, count: "exact" })
          .eq("status", "pending_payment")
          .gt("expires_at", new Date().toISOString()),
        supabase()
          .from("bookings")
          .select("id", { head: true, count: "exact" })
          .eq("status", "confirmed")
          .gte("starts_at", a)
          .lt("starts_at", b),
      ]);
      for (const q of queries) if (q.error) throw q.error;
      const next = [
        { label: "Marcações do dia", value: queries[0].count || 0 },
        { label: "A aguardar confirmação", value: queries[1].count || 0 },
        { label: "Confirmadas hoje", value: queries[2].count || 0 },
      ] as { label: string; value: string | number }[];
      if (role === "manager") {
        const { data, error } = await supabase().rpc("finance_summary", {
          p_from: a,
          p_to: b,
        });
        if (error) throw error;
        next.push(
          {
            label: "Receitas de hoje",
            value: money(Number(data.receipts) + Number(data.other)),
          },
          { label: "Despesas de hoje", value: money(data.expenses) },
          {
            label: "Saldo de hoje",
            value: money(
              Number(data.receipts) +
                Number(data.other) -
                Number(data.refunds) -
                Number(data.expenses),
            ),
          },
        );
        const stock = await supabase().rpc("low_stock");
        if (stock.error) throw stock.error;
        next.push({ label: "Produtos com stock baixo", value: stock.data });
      }
      S(next);
    })().catch((e) => M(e.message));
  }, [role]);
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">{today()} · Maputo</div>
        <h1>
          {role === "professional"
            ? "O seu dia, organizado."
            : "O salão, num só olhar."}
        </h1>
        <p>Dados reais, de acordo com as permissões da sua conta.</p>
      </div>
      <p role="status">{message}</p>
      <div className="grid stats">
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      {role === "manager" && (
        <p>
          <Link href="/admin/inventario">Consultar stock</Link> ·{" "}
          <Link href="/admin/financas">Ver resumo financeiro</Link>
        </p>
      )}
      <Agenda />
    </>
  );
}
