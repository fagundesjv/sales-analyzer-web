import { dayKey, minutesOn } from "./workspace-activity";
import { localDate } from "./inbox";
import { confirmedSales } from "./confirmed-sales";

export const previewActor = "Você (prévia)";
const unattributed = "Sem autoria registrada";
const empty = (day) => ({
  day,
  usageMs: 0,
  focusMs: 0,
  concluded: 0,
  wins: 0,
  wonCents: 0,
  sent: 0,
  questions: 0,
});
export function localUsageReport(ops, threads, period) {
  const days = Array.from({ length: period }, (_, i) =>
    localDate(i + 1 - period),
  );
  const people = new Map();
  function person(name) {
    if (!people.has(name))
      people.set(name, new Map(days.map((day) => [day, empty(day)])));
    return people.get(name);
  }
  const company = new Map(days.map((day) => [day, empty(day)]));
  person(previewActor);
  const aliases = new Map();
  for (const member of ops.members) {
    person(member.name);
    for (const previous of member.previousNames || []) aliases.set(previous, member.name);
  }
  for (const member of ops.members) aliases.set(member.name, member.name);
  function add(name, day, key, value = 1) {
    if (!company.has(day)) return;
    company.get(day)[key] += value;
    person(aliases.get(name) || name || unattributed).get(day)[key] += value;
  }
  for (const sample of ops.usageSamples || []) {
    add(sample.actor, sample.day, "usageMs", sample.minutes * 60000);
    add(sample.actor, sample.day, "focusMs", sample.focus * 60000);
  }
  for (const day of days) {
    const all = minutesOn(day),
      self = Math.min(all, minutesOn(day, true));
    if (self) add(previewActor, day, "usageMs", self * 60000);
    if (all > self) add(unattributed, day, "usageMs", (all - self) * 60000);
  }
  const dateOf = (row) => dayKey(new Date(row.at));
  for (const e of ops.events) {
    const who = e.actor || e.author;
    if (["Atendimento resolvido", "resolved", "won", "lost"].includes(e.kind))
      add(who, dateOf(e), "concluded");
    if (e.kind === "Resposta simulada") add(who, dateOf(e), "sent");
  }
  for (const e of confirmedSales(ops.events)) {
    add(e.actor || e.author, dateOf(e), "wins");
    add(e.actor || e.author, dateOf(e), "wonCents", e.cents || 0);
  }
  for (const e of ops.focusHistory || [])
    add(e.actor, dateOf(e), "focusMs", e.activeMs || 0);
  for (const t of Object.values(threads).flat())
    add(t.actor, dateOf(t), "questions");
  return {
    name: ops.profile.name,
    days: [...company.values()],
    people: [...people].map(([name, rows]) => ({
      id: name,
      name,
      days: [...rows.values()],
    })),
  };
}

export function usageDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  if (!minutes && ms > 0) return "<1 min";
  if (minutes < 60) return minutes + " min";
  return Math.floor(minutes / 60) + " h" + (minutes % 60 ? " " + (minutes % 60) + " min" : "");
}

export function sellerActivity(days) {
  const totals = { usageMs: 0, focusMs: 0, concluded: 0, wonCents: 0, wins: 0 };
  const activeDays = days.filter(day => day.usageMs || day.focusMs);
  for (const day of days) {
    for (const key of Object.keys(totals)) totals[key] += day[key] || 0;
  }
  return {
    ...totals, days, activeDays: activeDays.length, lastUse: activeDays.at(-1)?.day,
    winRate: totals.concluded ? Math.round(100 * totals.wins / totals.concluded) : null,
    centsPerHour: totals.usageMs > 0 ? Math.round(totals.wonCents * 3600000 / totals.usageMs) : null,
  };
}
export function portalUsageReport(report) {
  const company = report.companies[0];
  if (!company) return null;
  const people = new Map();
  const daily = [...company.daily].sort((a,b) => a.day.localeCompare(b.day));
  for (const day of daily)
    for (const person of day.people) {
      if (!people.has(person.userId))
        people.set(person.userId, {
          id: person.userId,
          name: person.name,
          rows: new Map(),
        });
      people.get(person.userId).rows.set(day.day, person);
    }
  return {
    name: company.name,
    days: daily,
    people: [...people.values()].map((p) => ({
      id: p.id,
      name: p.name,
      days: daily.map((d) => ({
        ...empty(d.day),
        ...p.rows.get(d.day),
      })),
    })),
  };
}
