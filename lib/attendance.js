import { baseline, localParts } from "./official/analysis";
import { historyOf, threadsOf } from "./inbox";

export function attendanceProfile(ops, channel, owner, contacts, days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const samples = [];
  for (const thread of threadsOf(ops)) {
    const contact = contacts.find((c) => c.id === thread.contactId);
    if (
      !contact ||
      (channel && thread.channel !== channel) ||
      (owner && contact.owner !== owner)
    )
      continue;
    let waiting;
    let replied = false;
    for (const message of historyOf(ops, thread)) {
      if (!message.outgoing) {
        waiting ??= message;
        continue;
      }
      if (waiting) {
        const start = Date.parse(waiting.sentAt);
        const end = Date.parse(message.sentAt);
        if (
          Number.isFinite(start) &&
          end >= start &&
          end >= cutoff.getTime() &&
          end <= Date.now()
        )
          samples.push({
            kind: replied ? "continuation" : "first",
            minutes: (end - start) / 60000,
            businessMinutes: null,
            conversationId: thread.id,
            repliedAt: message.sentAt,
            name: contact.name,
            channel: thread.channel,
          });
      }
      replied = true;
      waiting = null;
    }
  }
  const clock = localParts();
  const reference = (kind) => {
    const stats = baseline(
      samples.filter((s) => s.kind === kind),
      clock,
    );
    return stats.confidence === "ready"
      ? { minutes: stats.elapsed.median, by: "elapsed" }
      : null;
  };
  const pace = {
    timezone: "America/Sao_Paulo",
    schedule: null,
    first: reference("first"),
    continuation: reference("continuation"),
  };
  return {
    ...baseline(samples, clock),
    pace,
    samples: samples.sort((a, b) => b.repliedAt.localeCompare(a.repliedAt)),
  };
}
