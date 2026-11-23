import { historyOf, localDate, threadsOf, updatesOf } from "./inbox";
import { readSignal } from "./intake";
import { contactsOf, kindOf, parseMoney } from "./operation";
import { nextAttention } from "./thread-attention";

import { followUps, isFavorite, isResolved, opportunityValue } from "./conversation-work";
import { messageFiles } from "./attachments";

export const foldText = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const defaultFilters = {
  owner: "",
  status: "",
  slice: "",
  line: "",
  media: "",
  period: "",
  favoriteOnly: "",
  amount: "",
  amountValue: "",
  work: "",
};
export const sliceNames = {
  stars: "Favoritas",
  due: "Retorno até hoje",
  wait: "Espera de 30 min",
  payment: "Pedido de pagamento",
};
export const mediaNames = {
  any: "Qualquer anexo",
  image: "Imagem",
  audio: "Áudio",
  pdf: "PDF",
};

export function queueRows(ops, now = Date.now()) {
  const contacts = new Map(contactsOf(ops).map((c) => [c.id, c]));
  const today = localDate();
  return threadsOf(ops).flatMap((thread) => {
    const contact = contacts.get(thread.contactId);
    if (!contact) return [];
    const messages = historyOf(ops, thread);
    const last = messages.at(-1);
    const inbound = messages.filter((m) => !m.outgoing);
    const recent = updatesOf(ops, thread)[0];
    const latest =
      recent?.at || thread.createdAt || now - (thread.minutesAgo || 0) * 60000;
    const lastInbound = inbound.at(-1);
    const type = readSignal(lastInbound?.text || "");
    const tasks = followUps(ops, thread, contact);
    const done = isResolved(ops, thread, tasks, now);
    const deadline = nextAttention(ops, thread, contact);
    const due =
      !done &&
      (tasks.some((t) => t.due && t.due <= today) ||
        Boolean(deadline && Date.parse(deadline.at) <= now));
    const files = inbound.flatMap(messageFiles);
    const draft = Boolean(
      ops.inboxDrafts[thread.id]?.trim() ||
      ops.noteDrafts?.[thread.id]?.trim() ||
      ops.draftFiles?.[thread.id]?.length ||
      ops.replyReferences?.[thread.id],
    );
    const line =
      thread.channel === "whatsapp"
        ? (ops.lines || []).find((l) => l.id === thread.lineId)?.name ||
          thread.account
        : "";
    const waiting = Boolean(last && !last.outgoing && !done);
    const payment = waiting && ["pagamento", "comprovacao"].includes(type);
    const searchable = foldText(
      [
        contact.name,
        contact.owner,
        contact.product,
        contact.phone,
        thread.account,
        thread.subject,
        line,
        ...messages.map((m) =>
          [m.text, ...messageFiles(m).map((f) => f.name)]
            .filter(Boolean)
            .join(" "),
        ),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return [
      {
        thread,
        contact,
        recent,
        preview: last?.text || last?.attachment?.name || "",
        last,
        latest,
        elapsed: Math.max(0, Math.floor((now - latest) / 60000)),
        waiting,
        due,
        follow: !done && (tasks.length > 0 || Boolean(deadline)),
        done,
        payment,
        draft,
        line,
        files,
        searchable,
        favorite: isFavorite(ops, thread),
        amount: opportunityValue(ops, contact),
        status: kindOf(contact, ops),
      },
    ];
  });
}

export function matchesFilters(row, filters) {
  const amount = row.amount;
  const limit = parseMoney(String(filters.amountValue ?? ""), { allowZero: true });
  return (
    (!filters.favoriteOnly || row.favorite) &&
    (!filters.work || (filters.work === "closed" ? row.done : !row.done)) &&
    (!filters.amount ||
      (row.status === "risk" &&
        (filters.amount === "absent"
          ? amount == null
          : amount != null &&
            (filters.amount === "known" ||
              (filters.amount === "min"
                ? limit !== null && amount >= limit
                : limit !== null && amount <= limit))))) &&
    (!filters.owner || row.contact.owner === filters.owner) &&
    (!filters.status || row.status === filters.status) &&
    (!filters.line || row.line === filters.line) &&
    (!filters.period || row.elapsed <= Number(filters.period) * 60) &&
    (!filters.slice ||
      {
        stars: row.favorite,
        due: row.due,
        wait: row.waiting && row.elapsed >= 30,
        payment: row.payment,
      }[filters.slice]) &&
    (!filters.media ||
      row.files.some((f) => {
        if (filters.media === "any") return true;
        if (filters.media === "pdf")
          return f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
        return f.type?.startsWith(filters.media + "/");
      }))
  );
}
