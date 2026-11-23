import { attentionDeadline, replyFollowsD89 } from "./official/analysis";
import { updatesOf } from "./inbox";
import { kindOf } from "./operation";

export function nextAttention(ops, thread, contact) {
  if (!["risk", "lost"].includes(kindOf(contact, ops))) return null;
  const latest = updatesOf(ops, thread)[0],
    last = thread.messages.at(-1);
  const outgoing = latest
    ? latest.kind === "Resposta simulada"
    : last?.outgoing;
  if (!outgoing) return null;
  const resolvedAt = latest ? new Date(latest.at).toISOString() : last?.sentAt;
  if (!replyFollowsD89(resolvedAt)) return null;
  const days = ops.returnCycle?.days?.[0];
  const config = days
    ? { toques: [{ dias: days }], diasUteis: "corridos" }
    : null;
  return attentionDeadline({ resolvedAt, config });
}
