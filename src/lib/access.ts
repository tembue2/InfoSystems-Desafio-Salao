"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
export type Role = "manager" | "reception" | "professional" | "customer";
export function useAccess() {
  const [state, set] = useState<{
    role: Role | null;
    id: string | null;
    loading: boolean;
    error: string;
  }>({ role: null, id: null, loading: true, error: "" });
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const {
          data: { user },
          error,
        } = await supabase().auth.getUser();
        if (error || !user) {
          if (live) set({ role: null, id: null, loading: false, error: "" });
          return;
        }
        const { data, error: e } = await supabase()
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (e) throw e;
        if (live)
          set({ role: data.role, id: user.id, loading: false, error: "" });
      } catch (e) {
        if (live)
          set({
            role: null,
            id: null,
            loading: false,
            error: (e as Error).message,
          });
      }
    }
    void load();
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange(() => {
      setTimeout(() => void load(), 0);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  return state;
}
export const money = (v: unknown) =>
  `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
export const dateTime = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" })
    : "—";
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Maputo" });
export function bounds(from: string, to: string) {
  const end = new Date(`${to}T00:00:00+02:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return [`${from}T00:00:00+02:00`, end.toISOString()];
}
