import { contactsOf, kindOf } from "./operation";
import { historyOf, localDate, primaryThread, threadsOf } from "./inbox";
import { confirmedSales } from "./confirmed-sales";
import { dayKey } from "./workspace-activity";

function messageDay(message, fallback) {
  if (message.sentAt && Number.isFinite(Date.parse(message.sentAt)))
    return dayKey(new Date(message.sentAt));
  const when = message.when || "";
  if (/ontem/i.test(when)) return localDate(-1);
  const days = when.match(/há (\d+) dias?/i);
  if (days) return localDate(-Number(days[1]));
  if (/hoje/i.test(when)) return localDate();
  return fallback;
}
export function commercialBoard(
  ops,
  { channel = "todos", owner = "", period = 7 } = {},
) {
  const people = new Map(contactsOf(ops).map((c) => [c.id, c]));
  const days = Array.from({ length: period }, (_, i) =>
    localDate(i + 1 - period),
  );
  const points = new Map(
    days.map((day) => [day, { day, conversations: 0, replies: 0, sales: 0 }]),
  );
  const all = threadsOf(ops).filter(
    (t) =>
      (channel === "todos" || channel === t.channel) &&
      people.has(t.contactId) &&
      (!owner || owner === people.get(t.contactId).owner),
  );
  const active = [];
  for (const thread of all) {
    const touched = new Set(),
      fallback = dayKey(
        new Date(
          thread.createdAt || Date.now() - (thread.minutesAgo || 0) * 60000,
        ),
      );
    for (const m of historyOf(ops, thread)) {
      const day = messageDay(m, fallback);
      if (!points.has(day)) continue;
      touched.add(day);
      if (m.outgoing) points.get(day).replies++;
    }
    if (touched.size) active.push(thread);
    for (const day of touched) points.get(day).conversations++;
  }
  const byThread = new Map(all.map((t) => [t.id, t]));
  const sales = confirmedSales(ops.events).filter((e) => {
    const contact = people.get(e.contact),
      thread = byThread.get(e.threadId || (contact && primaryThread(contact)));
    const point = points.get(dayKey(new Date(e.at)));
    if (!thread || !point) return false;
    point.sales++;
    if (!active.includes(thread)) active.push(thread);
    return true;
  });
  const contacts = [...new Set(active.map((t) => people.get(t.contactId)))];
  const risk = contacts.filter((c) => kindOf(c, ops) === "risk");
  return { days: [...points.values()], active, contacts, risk, sales, people };
}
