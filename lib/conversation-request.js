import { montarPedidoEmAberto } from "./official/analysis";
import { historyOf } from "./inbox";

export const evidenceId = (message, index) => message.id || "inicial-" + index;
export function conversationRequest(ops, thread) {
  const messages = historyOf(ops, thread).map((message, i) => {
    const mime = message.attachment?.type;
    return {
      id: evidenceId(message, i),
      direction: message.outgoing ? "outbound" : "inbound",
      body: message.text,
      sentAt: message.sentAt || "",
      contentType: mime
        ? /^(image|audio|video)\//.exec(mime)?.[1] || "document"
        : "text",
    };
  });
  // Imported transcripts can be ordered without individual timestamps.
  return montarPedidoEmAberto({
    mensagens: messages,
    agora: messages.every((m) => m.sentAt) ? new Date().toISOString() : "",
  });
}
