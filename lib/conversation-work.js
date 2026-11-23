import { primaryThread } from "./inbox";
import { confirmedSales } from "./confirmed-sales";

export function isFavorite(ops, thread) {
  return ops.threadStars?.[thread.id] ?? ops.stars.includes(thread.contactId);
}
export function toggleFavorite(ops, thread) {
  return {
    threadStars: { ...ops.threadStars, [thread.id]: !isFavorite(ops, thread) },
  };
}
export function followUps(ops, thread, contact) {
  return ops.tasks
    .filter(
      (t) =>
        !t.done &&
        t.contact === contact.id &&
        (t.threadId || primaryThread(contact)) === thread.id,
    )
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
}
const closing = new Set(["won", "lost", "resolved", "Atendimento resolvido"]);
const opening = new Set(["risk", "Atendimento reaberto", "Mensagem recebida"]);
export function isResolved(ops, thread, tasks, now = Date.now()) {
  for (const e of ops.events) {
    if (e.threadId ? e.threadId !== thread.id : e.contact !== thread.contactId)
      continue;
    if (opening.has(e.kind)) return false;
    if (closing.has(e.kind)) {
      return !tasks.some((t) => {
        if (!t.due) return false;
        const dueAt = new Date(t.due + "T00:00:00").getTime();
        return dueAt > e.at && dueAt <= now;
      });
    }
  }
  const old = ops.outcomes[thread.contactId];
  return Boolean(
    old &&
    !ops.events.some(
      (e) => e.contact === thread.contactId && closing.has(e.kind),
    ) &&
    closing.has(old.kind),
  );
}

export function opportunityValue(ops, contact, sale) {
  const decision = ops.outcomes[contact.id];
  if ((decision?.kind ?? contact.baseline) !== "won") return contact.cents;
  if (decision?.cents != null) return decision.cents;
  const confirmed =
    sale === undefined
      ? confirmedSales(ops.events).find((entry) => entry.contact === contact.id)
      : sale;
  return confirmed?.cents ?? null;
}
