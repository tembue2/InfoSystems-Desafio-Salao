"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Recover() {
  const [email, E] = useState(""),
    [password, P] = useState(""),
    [recovery, R] = useState(false),
    [message, M] = useState(""),
    [busy, B] = useState(false);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") R(true);
    });
    if (location.hash.includes("type=recovery")) R(true);
    return () => subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    B(true);
    try {
      const { error } = recovery
        ? await supabase().auth.updateUser({ password })
        : await supabase().auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/recuperar`,
          });
      if (error) throw error;
      M(
        recovery
          ? "Palavra-passe actualizada. Pode entrar na sua conta."
          : "Se o endereço corresponder a uma conta, receberá as instruções de recuperação.",
      );
    } catch (e) {
      M((e as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <div className="pagehead">
        <h1>Recuperar acesso</h1>
      </div>
      <form className="card" onSubmit={submit}>
        {recovery ? (
          <label>
            Nova palavra-passe
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => P(e.target.value)}
            />
          </label>
        ) : (
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => E(e.target.value)}
            />
          </label>
        )}
        <button disabled={busy}>
          {busy
            ? "Aguarde…"
            : recovery
              ? "Guardar palavra-passe"
              : "Enviar instruções"}
        </button>
        <p role="status">{message}</p>
        <a href="/entrar">Voltar à entrada</a>
      </form>
    </>
  );
}
