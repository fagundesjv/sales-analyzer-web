"use client";
import { useState } from "react";
import { ChartCard, MeterList } from "@content-ventures/design-system/v3";
import { contactsOf, kindOf, money } from "../lib/operation";
import { inboxHref, primaryThread } from "../lib/inbox";
import { Pills } from "../src/ui/os/pills";
const measures = [
  { value: "all", label: "Procura" },
  { value: "risk", label: "Em risco" },
  { value: "won", label: "Ganhas" },
];
export function ProductDemand({ ops }) {
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState("");
  const items = new Map();
  for (const contact of contactsOf(ops)) {
    if (mode !== "all" && kindOf(contact, ops) !== mode) continue;
    const name = contact.product || "Produto a identificar";
    items.set(name, [...(items.get(name) || []), contact]);
  }
  const ranked = [...items].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"),
  );
  const name = items.has(selected) ? selected : ranked[0]?.[0];
  return (
    <ChartCard
      title="Procura por produto"
      titleAs="h2"
      description="Negociações por produto mencionado"
      actions={
        <Pills
          size="sm"
          label="Indicador de produtos"
          items={measures}
          value={mode}
          onChange={setMode}
        />
      }
    >
      {ranked.length ? (
        <>
          <MeterList
            label="Produtos nas negociações"
            shares={false}
            items={ranked
              .slice(0, 8)
              .map(([key, group]) => ({
                key,
                label: key,
                value: group.length,
                share: (100 * group.length) / ranked[0][1].length,
                color: "teal",
              }))}
          />
          <details className="product-evidence">
            <summary>Ver conversas por produto</summary>
            <label className="op-field">
              Produto
              <select
                value={name}
                onChange={(e) => setSelected(e.target.value)}
              >
                {ranked.map(([key]) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
            {items.get(name).map((c) => (
              <a key={c.id} href={inboxHref(primaryThread(c))}>
                {c.name}
                <span>
                  {c.cents != null ? money(c.cents) : "Valor a apurar"}
                </span>
              </a>
            ))}
          </details>
        </>
      ) : (
        <p className="muted">Nenhuma negociação neste recorte.</p>
      )}
    </ChartCard>
  );
}
