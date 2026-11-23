import { foldText } from "./conversation-queue";

// Existing catalog rows predate item types. Billing units also come from the official catalog.
export function catalogKind(item) {
  if (item?.kind === "service" || item?.kind === "product") return item.kind;
  return ["serviço", "projeto", "hora", "mês"].includes(item?.billingUnit) ||
    item?.name === "Consultoria de interiores"
    ? "service"
    : "product";
}
export function billingUnit(item) {
  return (
    item.billingUnit ||
    (catalogKind(item) === "service" ? "serviço" : "unidade")
  );
}

export function matchesCatalogSearch(item, normalizedQuery) {
  return foldText([item.name, item.sku, item.category, ...(item.aliases || [])]
    .filter(Boolean).join(" ")).includes(normalizedQuery);
}
