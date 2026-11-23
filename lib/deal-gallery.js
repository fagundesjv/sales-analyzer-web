import { confirmedSales } from "./confirmed-sales";
import { foldText } from "./conversation-queue";
import { isFavorite, opportunityValue } from "./conversation-work";
import { channels, historyOf, primaryThread, threadsOf } from "./inbox";
import { contactsOf, kindOf } from "./operation";
import { recoveryQueue } from "./recovery-queue";

export const dealStages = [
  { key: "risk", label: "Em risco" },
  { key: "lost", label: "Perdidas" },
  { key: "won", label: "Ganhas" },
  { key: "resolved", label: "Resolvidas" },
];
export const dealViews = [
  { key: "all", label: "Todas" },
  { key: "star", label: "Favoritas" },
  { key: "done", label: "Revisadas" },
];
export function galleryHref(stage, view) {
  return ["#oportunidades", stage, view]
    .filter((k) => k && k !== "all")
    .join("/");
}
export function inDealView(row, view) {
  return view === "star" ? row.favorite : view === "done" ? row.reviewed : true;
}

export function galleryRecords(ops, saved = {}) {
  const ranked = new Map(
    recoveryQueue(ops).map((row, i) => [row.thread.id, i]),
  );
  const byContact = new Map();
  for (const thread of threadsOf(ops)) {
    const key = thread.contactId;
    if (!byContact.has(key)) byContact.set(key, []);
    byContact.get(key).push({
      thread,
      favorite: isFavorite(ops, thread),
      rank: ranked.get(thread.id) ?? Infinity,
      text: foldText(
        [
          channels[thread.channel],
          thread.subject,
          ...historyOf(ops, thread).map((m) => m.text),
        ]
          .filter(Boolean)
          .join(" "),
      ),
    });
  }
  const wins = new Map();
  for (const event of confirmedSales(ops.events)) {
    if (!wins.has(event.contact)) wins.set(event.contact, event);
  }
  return contactsOf(ops)
    .map((contact) => {
      const entries = byContact.get(contact.id) || [];
      const stage = kindOf(contact, ops);
      const win = stage === "won" ? wins.get(contact.id) : null;
      const decision = ops.outcomes[contact.id];
      const first = entries.reduce(
        (best, entry) => (!best || entry.rank < best.rank ? entry : best),
        null,
      );
      const preferred =
        entries.find((e) => e.thread.id === win?.threadId) ||
        (Number.isFinite(first?.rank)
          ? first
          : entries.find((e) => e.thread.id === primaryThread(contact))) ||
        first;
      return {
        contact,
        stage,
        entries,
        preferred,
        win,
        decision,
        rank: first?.rank ?? Infinity,
        cents: opportunityValue(ops, contact, win),
        favorite: entries.some((e) => e.favorite),
        reviewed: Object.hasOwn(saved, contact.id),
        text: foldText(
          [
            contact.name,
            contact.product,
            contact.owner,
            contact.title,
            contact.category,
            decision?.reason,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (b.win?.at || 0) - (a.win?.at || 0) ||
        (b.cents || 0) - (a.cents || 0) ||
        a.contact.name.localeCompare(b.contact.name, "pt-BR"),
    );
}

export function matchingDeals(records, owner, query, view) {
  const term = foldText(query.trim());
  const matches = [];
  for (const row of records) {
    if (owner !== "Todos" && row.contact.owner !== owner) continue;
    let source = row.preferred;
    if (view === "star" && !source?.favorite)
      source = row.entries.find((e) => e.favorite) || source;
    if (term && !row.text.includes(term)) {
      source = row.entries.find((e) => e.text.includes(term));
      if (!source) continue;
    }
    matches.push({ ...row, source });
  }
  return matches;
}
