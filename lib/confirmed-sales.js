import { confirmedSaleHistory } from "./official/analysis";
export function confirmedSales(events) {
  const corrections = new Map();
  for (const event of events) {
    if (event.kind !== "Correção de venda" || !event.saleId) continue;
    const rows = corrections.get(event.saleId) || [];
    rows.push(event);
    corrections.set(event.saleId, rows);
  }
  return events
    .filter((e) => e.kind === "won")
    .map((sale) => {
      const changes = corrections.get(sale.id);
      if (!changes?.length) return sale;
      const decisions = [sale, ...changes.slice().reverse()].map(
        (event, i) => ({
          id: String(i).padStart(12, "0"),
          kind: "won",
          recordedAt: new Date(event.at).toISOString(),
          amountCents: event.cents,
          actorName: event.owner || sale.owner || "Equipe",
        }),
      );
      const [corrected] = confirmedSaleHistory(decisions, null);
      return { ...sale, cents: corrected.amountCents, corrected: true };
    });
}
