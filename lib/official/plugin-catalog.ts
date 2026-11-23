export type PluginCategory = "conversations" | "crm" | "marketing" | "data";
export type PluginAvailability = "available" | "planned";

export type PluginCatalogEntry = {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  availability: PluginAvailability;
  capability: string;
  searchTerms: readonly string[];
};

export const pluginCategoryLabels: Record<PluginCategory, string> = {
  conversations: "Conversas",
  crm: "CRM",
  marketing: "Marketing",
  data: "Dados e automação",
};

/** The catalog deliberately separates an integration's capability from its connection method. */
export const pluginCatalog: readonly PluginCatalogEntry[] = [
  {
    id: "whatsapp-qr",
    name: "WhatsApp por QR Code",
    description: "Conecte um celular e importe o histórico que está disponível no WhatsApp.",
    category: "conversations",
    availability: "available",
    capability: "Fonte de conversas",
    searchTerms: ["whatsapp", "celular", "qr code"],
  },
  {
    id: "helena-nowz",
    name: "Nowz",
    description: "Conecte os canais da Nowz, importe as conversas e rode a análise da Zoe.",
    category: "conversations",
    availability: "available",
    capability: "Fonte de conversas",
    searchTerms: ["whatsapp", "helena", "elena", "nowz", "white label"],
  },
  {
    id: "datacrazy",
    name: "DataCrazy",
    description: "Conecte sua conta e consulte as conversas atendidas no DataCrazy, sem QR Code.",
    category: "conversations",
    availability: "available",
    capability: "Fonte de conversas",
    searchTerms: ["datacrazy", "data crazy", "whatsapp", "api", "instâncias"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Relacione negócios, etapas e ganhos às conversas que levaram à venda.",
    category: "crm",
    availability: "planned",
    capability: "Contexto comercial",
    searchTerms: ["crm", "ganho", "negócios"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Compare o avanço do funil com as conversas que geraram oportunidades.",
    category: "crm",
    availability: "planned",
    capability: "Contexto comercial",
    searchTerms: ["crm", "funil", "negócios"],
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    description: "Cruze anúncios, mensagens e conversões para entender a origem das vendas.",
    category: "marketing",
    availability: "planned",
    capability: "Origem da demanda",
    searchTerms: ["facebook", "instagram", "anúncios", "ads"],
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Envie eventos do Sales Analyzer para os fluxos que sua operação já utiliza.",
    category: "data",
    availability: "planned",
    capability: "Automação",
    searchTerms: ["api", "eventos", "integração"],
  },
];

export function filterPluginCatalog(entries: readonly PluginCatalogEntry[], query: string, category: PluginCategory | "all") {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return entries.filter((plugin) => {
    const matchesCategory = category === "all" || plugin.category === category;
    const haystack = [plugin.name, plugin.description, plugin.capability, pluginCategoryLabels[plugin.category], ...plugin.searchTerms]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    return matchesCategory && (!normalized || haystack.includes(normalized));
  });
}
