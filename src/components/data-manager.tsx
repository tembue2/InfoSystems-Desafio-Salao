"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export type Row = Record<string, string | number | boolean | null>;
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "checkbox"
    | "time"
    | "date"
    | "datetime-local"
    | "email"
    | "select"
    | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
};
export default function DataManager({
  table,
  title,
  fields,
  columns,
  order = "id",
  canEdit = true,
  allowCreate = true,
  allowUpdate = true,
  allowDelete = false,
  onSelect,
  filter,
}: {
  table: string;
  title: string;
  fields: Field[];
  columns?: string[];
  order?: string;
  canEdit?: boolean;
  allowCreate?: boolean;
  allowUpdate?: boolean;
  allowDelete?: boolean;
  onSelect?: (row: Row) => void;
  filter?: [string, string];
}) {
  const [rows, R] = useState<Row[]>([]),
    [draft, D] = useState<Row>({}),
    [editing, E] = useState(false),
    [search, S] = useState(""),
    [page, P] = useState(0),
    [total, T] = useState(0),
    [loading, L] = useState(true),
    [busy, B] = useState(false),
    [message, M] = useState("");
  const filterKey = filter?.[0],
    filterValue = filter?.[1];
  const load = useCallback(async () => {
    L(true);
    try {
      let q = supabase()
        .from(table)
        .select("*", { count: "exact" })
        .order(order)
        .range(page * 25, page * 25 + 24);
      if (filterKey) q = q.eq(filterKey, filterValue);
      const searchField = fields.find(
        (f) => f.type === undefined || f.type === "text",
      )?.key;
      if (search && searchField)
        q = q.ilike(searchField, `%${search.replace(/[%_]/g, "")}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      R(data || []);
      T(count || 0);
    } catch (e) {
      M((e as Error).message);
    } finally {
      L(false);
    }
  }, [table, order, page, search, filterKey, filterValue, fields]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    B(true);
    M("");
    try {
      const value: Row = {};
      for (const f of fields) {
        let v = draft[f.key];
        if (f.type === "number")
          v = v === "" || v === undefined ? null : Number(v);
        else if (f.type === "checkbox") v = Boolean(v);
        else if (f.type === "datetime-local")
          v = v ? new Date(`${v}+02:00`).toISOString() : null;
        else v = typeof v === "string" ? v.trim() : (v ?? null);
        if (f.type === "select" && v === "") v = null;
        value[f.key] = v;
      }
      const q = draft.id
        ? supabase().from(table).update(value).eq("id", draft.id)
        : supabase().from(table).insert(value);
      const { error } = await q.select("id").single();
      if (error) throw error;
      M("Guardado com sucesso.");
      E(false);
      D({});
      await load();
    } catch (e) {
      M((e as Error).message);
    } finally {
      B(false);
    }
  }
  function edit(row: Row) {
    const copy = { ...row };
    for (const f of fields)
      if (f.type === "datetime-local" && copy[f.key]) {
        const d = new Date(String(copy[f.key]));
        d.setUTCMinutes(d.getUTCMinutes() + 120);
        copy[f.key] = d.toISOString().slice(0, 16);
      }
    D(copy);
    E(true);
  }
  async function remove(row: Row) {
    if (!confirm("Eliminar este horário ou indisponibilidade?")) return;
    B(true);
    const { error } = await supabase().from(table).delete().eq("id", row.id);
    if (error) M(error.message);
    else {
      M("Registo removido.");
      await load();
    }
    B(false);
  }
  return (
    <section className="stack">
      <div className="row">
        <h2>{title}</h2>
        {canEdit && allowCreate && (
          <button
            onClick={() => {
              D(
                Object.fromEntries(
                  fields.map((f) => [f.key, f.type === "checkbox" ? true : ""]),
                ),
              );
              E(true);
            }}
          >
            Adicionar
          </button>
        )}
      </div>
      <input
        aria-label={`Pesquisar ${title}`}
        placeholder="Pesquisar por nome…"
        value={search}
        onChange={(e) => {
          S(e.target.value);
          P(0);
        }}
      />
      {editing && (
        <form className="card form-grid" onSubmit={save}>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={String(draft[f.key] ?? "")}
                  onChange={(e) => D({ ...draft, [f.key]: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  required={f.required}
                  value={String(draft[f.key] ?? "")}
                  onChange={(e) => D({ ...draft, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  maxLength={f.type === "text" || !f.type ? 200 : undefined}
                  checked={
                    f.type === "checkbox" ? Boolean(draft[f.key]) : undefined
                  }
                  value={
                    f.type === "checkbox"
                      ? undefined
                      : String(draft[f.key] ?? "")
                  }
                  onChange={(e) =>
                    D({
                      ...draft,
                      [f.key]:
                        f.type === "checkbox"
                          ? e.target.checked
                          : e.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
          <div className="row">
            <button disabled={busy}>{busy ? "A guardar…" : "Guardar"}</button>
            <button type="button" className="ghost" onClick={() => E(false)}>
              Fechar
            </button>
          </div>
        </form>
      )}
      <div role="status" aria-live="polite">
        {message}
      </div>
      {loading ? (
        <p role="status">A carregar…</p>
      ) : (
        <div className="card tablewrap">
          <table>
            <thead>
              <tr>
                {(columns || fields.map((f) => f.key)).map((k) => (
                  <th key={k}>
                    {fields.find((f) => f.key === k)?.label ||
                      (
                        {
                          quantity: "Quantidade",
                          created_at: "Data",
                        } as Record<string, string>
                      )[k] ||
                      k}
                  </th>
                ))}
                {(canEdit || onSelect) && <th>Acções</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={String(row.id)}
                  className={
                    row.quantity !== undefined &&
                    Number(row.quantity) <= Number(row.min_quantity)
                      ? "low-stock-row"
                      : undefined
                  }
                >
                  {(columns || fields.map((f) => f.key)).map((k) => (
                    <td key={k}>
                      {typeof row[k] === "boolean"
                        ? row[k]
                          ? "Sim"
                          : "Não"
                        : (fields
                            .find((f) => f.key === k)
                            ?.options?.find((o) => o.value === row[k])?.label ??
                          String(row[k] ?? "—"))}
                    </td>
                  ))}
                  {(canEdit || onSelect) && (
                    <td>
                      {canEdit && allowUpdate && (
                        <button className="ghost" onClick={() => edit(row)}>
                          Editar
                        </button>
                      )}
                      {canEdit && allowDelete && (
                        <button
                          disabled={busy}
                          className="ghost"
                          onClick={() => void remove(row)}
                        >
                          Eliminar
                        </button>
                      )}
                      {onSelect && (
                        <button className="ghost" onClick={() => onSelect(row)}>
                          Detalhes
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={12}>Sem registos para apresentar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="row">
        <span>
          {total} registo(s) · página {page + 1}
        </span>
        <div>
          <button
            className="ghost"
            disabled={!page || loading}
            onClick={() => P(page - 1)}
          >
            Anterior
          </button>
          <button
            className="ghost"
            disabled={(page + 1) * 25 >= total || loading}
            onClick={() => P(page + 1)}
          >
            Seguinte
          </button>
        </div>
      </div>
    </section>
  );
}
