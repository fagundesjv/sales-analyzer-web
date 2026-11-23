import { threadsOf, updatesOf, channels } from "./inbox";
import { contactsOf, kindOf, money } from "./operation";
import { signals } from "./demo";
import { readingOf } from "./intake";

export function createReading(ops, source, days) {
  const cutoff = Date.now() - Number(days) * 86400000;
  const matched = threadsOf(ops)
    .filter((t) => {
      const last =
        updatesOf(ops, t)[0]?.at ||
        t.createdAt ||
        Date.now() - t.minutesAgo * 60000;
      return (
        last >= cutoff &&
        (source === "Caixa de entrada" ||
          channels[t.channel] === source ||
          (t.channel === "whatsapp" && source === "linha/" + (t.lineId || ops.lines?.find(line => line.primaryLine)?.id)) ||
          (source === "Nowz" &&
            t.channel === "whatsapp" &&
            signals.some((s) => s.id === t.contactId && s.owner === "Caio")))
      );
    })
    .sort(
      (a, b) =>
        (updatesOf(ops, b)[0]?.at || b.createdAt || -b.minutesAgo) -
        (updatesOf(ops, a)[0]?.at || a.createdAt || -a.minutesAgo),
    );
  const cases = contactsOf(ops)
    .filter((s) => matched.some((t) => t.contactId === s.id))
    .map((s) => {
      const thread = matched.find((t) => t.contactId === s.id);
      const reading = readingOf(ops, s, thread);
      return {
        ...s,
        threadId: thread.id,
        status: kindOf(s, ops),
        quote: reading.evidence,
        next: reading.next,
        title: reading.title,
        category: reading.title,
      };
    });
  const run = {
    id: crypto.randomUUID(),
    name: "Raio-X comercial",
    sourceKey: source,
    source: source.startsWith("linha/")
      ? "WhatsApp · " +
        (ops.lines || []).find((l) => source === "linha/" + l.id)?.name
      : source,
    days: Number(days),
    at: Date.now(),
    records: cases,
    conversationCount: matched.length,
    ids: cases.map((s) => s.id),
    riskCents: cases
      .filter((s) => kindOf(s, ops) === "risk")
      .reduce((total, s) => total + (s.cents || 0), 0),
  };
  return run;
}

export function compareReading(run, runs) {
  const position = runs.findIndex((r) => r.id === run?.id);
  if (position < 0) return null;
  const previous = runs
    .slice(position + 1)
    .find(
      (r) =>
        (r.sourceKey || r.source) === (run.sourceKey || run.source) &&
        r.days === run.days,
    );
  if (!previous) return null;
  const before = new Map((previous.records || []).map((c) => [c.id, c]));
  const changed = (run.records || []).filter((c) => {
    const prior = before.get(c.id);
    return prior?.status && c.status && prior.status !== c.status;
  });
  const entered = run.ids.filter((id) => !previous.ids.includes(id)).length;
  const left = previous.ids.filter((id) => !run.ids.includes(id)).length;
  const delta = run.riskCents - previous.riskCents;
  const value = Number.isFinite(delta)
    ? delta === 0
      ? "O valor em risco ficou estável."
      : "O valor em risco " +
        (delta < 0 ? "caiu " : "subiu ") +
        money(Math.abs(delta)) +
        "."
    : "";
  return {
    previous,
    changed,
    text: [
      value,
      entered + " oportunidade(s) entraram e " + left + " saíram da janela.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
