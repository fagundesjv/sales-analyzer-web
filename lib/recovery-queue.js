import { followUps, isResolved } from "./conversation-work";
import { nextAttention } from "./thread-attention";
import { contactsOf, kindOf } from "./operation";
import { localDate, threadsOf, updatesOf } from "./inbox";
import { readSignal } from "./intake";

export function recoveryQueue(ops, { includeScheduled = false } = {}) {
  const contacts = new Map(
    contactsOf(ops).map((contact) => [contact.id, contact]),
  );
  const today = localDate();
  const rows = [];
  const now = Date.now();
  for (const thread of threadsOf(ops)) {
    const contact = contacts.get(thread.contactId);
    if (!contact || !["risk", "lost"].includes(kindOf(contact, ops))) continue;
    const tasks = followUps(ops, thread, contact);
    if (isResolved(ops, thread, tasks, now)) continue;
    const due = tasks
      .filter((t) => t.due && t.due <= today)
      .sort((a, b) => a.due.localeCompare(b.due))[0];
    const recent = updatesOf(ops, thread)[0];
    const last = thread.messages.at(-1);
    const waiting = recent
      ? recent.kind === "Mensagem recebida"
      : !last.outgoing;
    const deadline =
      !waiting && !tasks.length ? nextAttention(ops, thread, contact) : null;
    const needsReturn = deadline && Date.parse(deadline.at) <= now;
    if (
      !due &&
      !needsReturn &&
      (!waiting || (!includeScheduled && tasks.length))
    )
      continue;
    const quote = recent?.detail || last.text;
    const type = readSignal(quote);
    const hot = waiting && ["pagamento", "comprovacao"].includes(type);
    const elapsed =
      recent || thread.createdAt
        ? Math.max(
            0,
            Math.floor((now - (recent?.at || thread.createdAt)) / 60000),
          )
        : thread.minutesAgo;
    const delay =
      elapsed >= 1440
        ? Math.floor(elapsed / 1440) + " d"
        : elapsed >= 60
          ? Math.floor(elapsed / 60) + " h"
          : elapsed + " min";
    const reason = due
      ? due.due < today
        ? "Retorno atrasado"
        : "Retorno de hoje"
      : needsReturn
        ? "Retomar acompanhamento"
        : hot
          ? type === "comprovacao"
            ? "Confirmar pagamento"
            : "Cliente quer pagar"
          : "Aguarda resposta";
    rows.push({
      contact,
      thread,
      reason,
      priority: due || needsReturn ? 0 : hot ? 1 : 2,
      elapsed,
      delay,
      quote,
      waiting,
      owner: due?.owner || contact.owner,
    });
  }
  return rows.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.elapsed - a.elapsed ||
      a.thread.id.localeCompare(b.thread.id),
  );
}

export function focusQueue(ops) {
  return recoveryQueue(ops).filter(
    (row) =>
      (!ops.focus?.owner || row.owner === ops.focus.owner) &&
      !ops.focus?.handled?.includes(row.thread.id),
  );
}
export function nextFocusHref(ops, currentId, closedContactId) {
  const next = focusQueue(ops).find(
    (row) => row.thread.id !== currentId && row.contact.id !== closedContactId,
  );
  return next ? "#entrada/todos/" + next.thread.id : "#entrada";
}
