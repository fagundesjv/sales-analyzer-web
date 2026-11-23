"use client";
import { useEffect } from "react";
const sections = {
  inicio: "dashboard",
  zoe: "radar",
  conversas: "entrada",
  uso: "uso",
  produtos: "catalogo",
  conectores: "conexao",
  whatsapps: "whatsapps",
  empresa: "empresa",
  equipe: "equipe",
  diagnosticos: "diagnosticos",
  relatorio: "diagnosticos",
  vendedor: "entrada/rodada",
  "vendedor-conversas": "entrada",
  radar: "radar",
};
export function PreviewEntry({ id }) {
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    let route =
      sections[query.get("tela")] || sections[id.slice(7)] || "dashboard";
    if (query.get("modo") === "chat") route = "chat";
    if (query.get("aba") === "conversas") route = "entrada";
    if (query.get("aba") === "alertas") route = "alertas";
    if (query.get("foco") === "1") route = "entrada/rodada";
    window.location.replace("/#" + route);
  }, [id]);
  return (
    <main>
      <a href="/">Abrir Sales Analyzer</a>
    </main>
  );
}
