"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Policy() {
  const [text, set] = useState("A carregar as condições…");
  useEffect(() => {
    supabase()
      .from("salon_settings")
      .select("*")
      .single()
      .then(({ data, error }) =>
        set(
          error
            ? "Não foi possível carregar as condições. Contacte a recepção."
            : `Pré-reserva: ${data.hold_minutes} minutos (${data.policy_approved ? "política aprovada" : "regra provisória"}). O horário é libertado após este prazo se o pagamento integral não estiver validado. ${data.policy_text}`,
        ),
      );
  }, []);
  return <aside className="notice">{text}</aside>;
}
