"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/access";
import Policy from "./policy";
type Service = {
  id: string;
  name: string;
  description: string;
  price_mzn: number;
  duration_minutes: number;
};
export default function Catalog() {
  const [data, D] = useState<Service[]>([]),
    [error, E] = useState(""),
    [loading, L] = useState(true),
    [search, S] = useState("");
  useEffect(() => {
    supabase()
      .from("services")
      .select("*")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) E(error.message);
        else D(data || []);
        L(false);
      });
  }, []);
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">O seu próximo cuidado</div>
        <h1>Encontre o seu serviço.</h1>
        <p>
          Preços em meticais. Escolha o profissional e o horário no passo
          seguinte.
        </p>
      </div>
      <input
        aria-label="Pesquisar serviço"
        placeholder="Pesquisar serviços…"
        value={search}
        onChange={(e) => S(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>A carregar serviços…</p>
      ) : (
        <div className="grid module-grid">
          {data
            .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <article className="card" key={s.id}>
                <div className="eyebrow">{s.duration_minutes} minutos</div>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <p className="stat-value">{money(s.price_mzn)}</p>
                <Link className="button" href={`/reservar?service=${s.id}`}>
                  Escolher serviço ↗
                </Link>
              </article>
            ))}
          {!data.length && <p>Não existem serviços activos.</p>}
        </div>
      )}
      <Policy />
    </>
  );
}
