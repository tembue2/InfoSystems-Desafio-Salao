"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Entrar() {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (register) {
        const { error } = await supabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: name, phone } },
        });
        if (error) throw error;
        setMessage(
          "Registo recebido. Confirme o e-mail se a validação de e-mail estiver activa.",
        );
      } else {
        const { error } = await supabase().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const {
          data: { user },
        } = await supabase().auth.getUser();
        const { data: profile, error: profileError } = await supabase()
          .from("profiles")
          .select("role")
          .eq("id", user!.id)
          .single();
        if (profileError) throw profileError;
        window.location.href =
          profile.role === "customer" ? "/reservar" : "/admin";
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    await supabase().auth.signOut();
    setMessage("Sessão terminada.");
  }
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <div className="eyebrow">BEM-VINDA AO INFOSALÃO</div>
        <h2>O melhor do seu dia começa consigo.</h2>
        <p>Um espaço para organizar os seus momentos de beleza e cuidado.</p>
      </aside>
      <div className="auth-form">
        <div className="pagehead">
          <div className="eyebrow">Conta</div>
          <h1>{register ? "Criar conta" : "Entrar"}</h1>
          <p>Aceda à sua conta para marcar e acompanhar os seus serviços.</p>
        </div>
        <div>
          <a href="/recuperar">Esqueci-me da palavra-passe</a>
          <form onSubmit={submit}>
            {register && (
              <>
                <label>
                  Nome completo
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Telemóvel / WhatsApp
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              E-mail
              <input
                autoComplete="email"
                placeholder="nome@exemplo.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Palavra-passe
              <input
                autoComplete={register ? "new-password" : "current-password"}
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={loading}>
              {loading ? "Aguarde…" : register ? "Criar conta" : "Entrar"}
            </button>
          </form>
          <p>
            <button
              className="button ghost"
              onClick={() => {
                setRegister(!register);
                setMessage("");
              }}
            >
              {register ? "Já tenho conta" : "Criar nova conta"}
            </button>{" "}
            <button className="button ghost" onClick={logout}>
              Sair
            </button>
          </p>
          {message && (
            <div role="status" className="notice">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
