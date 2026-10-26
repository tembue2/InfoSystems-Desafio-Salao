"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Gate from "@/components/gate";
import { useAccess } from "@/lib/access";
import { roleLabels } from "@/lib/presentation";
export default function Profile() {
  return (
    <Gate roles={["manager", "reception", "professional", "customer"]}>
      <Form />
    </Gate>
  );
}
function Form() {
  const { id, role } = useAccess();
  const [name, N] = useState(""),
    [phone, P] = useState(""),
    [birth, B] = useState(""),
    [msg, M] = useState(""),
    [busy, S] = useState(false);
  useEffect(() => {
    if (id)
      supabase()
        .from("profiles")
        .select("full_name,phone,birth_date")
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error) M(error.message);
          else {
            N(data.full_name);
            P(data.phone || "");
            B(data.birth_date || "");
          }
        });
  }, [id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    S(true);
    try {
      const { error } = await supabase()
        .from("profiles")
        .update({ full_name: name.trim(), phone, birth_date: birth || null })
        .eq("id", id);
      if (error) throw error;
      M("Perfil actualizado.");
    } catch (e) {
      M((e as Error).message);
    } finally {
      S(false);
    }
  }
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">{role && roleLabels[role]}</div>
        <h1>Minha conta</h1>
      </div>
      <form className="card form-grid" onSubmit={save}>
        <label>
          Nome completo
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => N(e.target.value)}
          />
        </label>
        <label>
          Telemóvel
          <input
            maxLength={40}
            value={phone}
            onChange={(e) => P(e.target.value)}
          />
        </label>
        <label>
          Data de nascimento
          <input
            type="date"
            value={birth}
            onChange={(e) => B(e.target.value)}
          />
        </label>
        <button disabled={busy}>Guardar perfil</button>
      </form>
      <p role="status">{msg}</p>
      <button
        className="button ghost"
        onClick={async () => {
          const { error } = await supabase().auth.signOut();
          if (error) M(error.message);
          else location.href = "/entrar";
        }}
      >
        Terminar sessão
      </button>
    </>
  );
}
