"use client";
import { useState } from "react";
import { SearchField } from "@content-ventures/design-system/v3";
import { ArrowUpRight, Webhook } from "lucide-react";
import {
  pluginCatalog,
  filterPluginCatalog,
  pluginCategoryLabels,
} from "../lib/official/plugin-catalog";
import { Pills } from "../src/ui/os/pills";
import s from "./operations-board.module.css";

const assets = {
  "whatsapp-qr": "whatsapp.svg",
  "helena-nowz": "nowz.png",
  datacrazy: "datacrazy.png",
  hubspot: "hubspot.svg",
  pipedrive: "pipedrive.svg",
  "meta-ads": "meta.svg",
};
export function PluginMarket({ active, onOpen, route }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const views = { connected: "conectados", available: "disponiveis", planned: "em-breve" };
  const view = route.split("/")[1];
  const state = Object.keys(views).find(key => views[key] === view) ?? "all";
  const keyOf = (id) =>
    ({ "whatsapp-qr": "whatsapp", "helena-nowz": "nowz" })[id] || id;
  const status = (plugin) =>
    plugin.availability === "planned"
      ? "planned"
      : active(keyOf(plugin.id)) === null
        ? "unknown"
        : active(keyOf(plugin.id))
          ? "connected"
          : "available";
  const shown = filterPluginCatalog(pluginCatalog, query, category).filter(
    (p) => state === "all" || state === status(p),
  );
  return (
    <section className={s.market} aria-label="Catálogo de conectores">
      <div className={s.marketTools}>
        <SearchField
          label="Buscar conectores"
          enterKeyHint="search"
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar por nome ou função…"
        />
        <select
          className="sales-select"
          aria-label="Estado do conector"
          value={state}
          onChange={(e) => {
            const next = views[e.target.value];
            window.location.hash = next ? "conexao/" + next : "conexao";
          }}
        >
          <option value="all">Todos os estados</option>
          <option value="connected">Conectados</option>
          <option value="available">Disponíveis</option>
          <option value="planned">Em breve</option>
        </select>
      </div>
      <Pills
        label="Categoria de integração"
        value={category}
        onChange={setCategory}
        items={[
          { value: "all", label: "Todos" },
          ...Object.entries(pluginCategoryLabels).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
      />
      <div className={s.pluginGrid}>
        {shown.map((p) => {
          const planned = p.availability === "planned",
            Tag = planned ? "article" : "button";
          return (
            <Tag
              className={s.plugin}
              key={p.id}
              {...(!planned
                ? { type: "button", onClick: () => onOpen(keyOf(p.id)) }
                : {})}
            >
              <div className={s.pluginTop}>
                <span className={s.logo}>
                  {assets[p.id] ? (
                    <img alt="" src={"/assets/" + assets[p.id]} />
                  ) : (
                    <Webhook size={24} />
                  )}
                </span>
                <span className={s.status} data-on={status(p) === "connected"}>
                  {planned
                    ? "Em breve"
                    : status(p) === "connected"
                      ? "Conectado"
                      : status(p) === "unknown"
                        ? "Ver conexões"
                        : "Disponível"}
                </span>
              </div>
              <strong>{p.name}</strong>
              <p>{p.description}</p>
              <small>
                {pluginCategoryLabels[p.category]}
                {!planned && <ArrowUpRight size={15} />}
              </small>
            </Tag>
          );
        })}
      </div>
      {!shown.length && (
        <p className={s.empty}>{state === "connected" && !query && category === "all" ? "Nenhuma integração conectada." : "Nenhum conector corresponde aos filtros."}</p>
      )}
    </section>
  );
}
