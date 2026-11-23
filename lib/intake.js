import { channels, historyOf } from "./inbox";
import { parseMoney, timestamp } from "./operation";

export const signalsByType = {
  comprovacao: {
    title: "Cliente relata pagamento",
    next: "Conferir o recebimento e registrar o desfecho com o valor confirmado.",
    reply:
      "Obrigada pelo retorno! Vamos conferir o recebimento e confirmar o próximo passo por aqui.",
  },
  estoque: {
    title: "Disponibilidade de produto",
    next: "Conferir a disponibilidade e combinar o retorno.",
    reply: "Vou conferir a disponibilidade e te aviso por aqui.",
  },
  pagamento: {
    title: "Intenção de pagamento",
    next: "Conferir a condição combinada e orientar o pagamento.",
    reply:
      "Vou conferir a condição de pagamento e te passar os próximos passos.",
  },
  entrega: {
    title: "Prazo ou retirada",
    next: "Confirmar o prazo e a modalidade de entrega.",
    reply: "Vou verificar o prazo e as opções de entrega para você.",
  },
  preco: {
    title: "Objeção de preço",
    next: "Entender a condição que viabilizaria a compra.",
    reply: "Podemos rever as condições. Qual seria a melhor opção para você?",
  },
  proposta: {
    title: "Proposta em aberto",
    next: "Revisar a proposta e esclarecer o ponto em aberto.",
    reply:
      "Você ficou com alguma dúvida sobre a proposta? Posso ajudar a esclarecer.",
  },
  outro: {
    title: "Atendimento em análise",
    next: "Revisar o pedido e combinar o próximo passo.",
    reply: "Recebi sua mensagem. Posso confirmar os detalhes com você?",
  },
};

export function readMessages(transcript) {
  const messages = [];
  for (const line of transcript.trim().split(/\r?\n/)) {
    const prefix = /^(Cliente|Equipe)\s*:\s*(.*)$/i.exec(line.trimStart());
    if (prefix)
      messages.push({
        outgoing: prefix[1].toLowerCase() === "equipe",
        text: prefix[2],
      });
    else if (messages.length) messages[messages.length - 1].text += "\n" + line;
    else messages.push({ outgoing: false, text: line });
  }
  return messages
    .map((m) => ({ ...m, text: m.text.trim() }))
    .filter((m) => m.text);
}

export function readSignal(text) {
  const line = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const rules = [
    ["comprovacao", /ja paguei|fiz o pix|pagamento (?:foi )?feito|comprovante/],
    ["estoque", /estoque|esgot|disponib/],
    ["pagamento", /pagar|pagamento|pix|boleto/],
    ["entrega", /entreg|retir|frete|prazo/],
    ["preco", /caro|desconto|orcamento|preco/],
    ["proposta", /proposta|escopo|cotacao/],
  ];
  return rules.find(([, pattern]) => pattern.test(line))?.[0] || "outro";
}

export function makeIntake({
  name,
  channel,
  subject,
  product,
  amount,
  type,
  baseline,
  owner,
  messages,
}) {
  const id = crypto.randomUUID();
  const threadId = id + "-" + channel;
  const incoming = messages.filter((m) => !m.outgoing).at(-1);
  const previous = messages
    .slice(0, messages.lastIndexOf(incoming))
    .filter((m) => m.outgoing)
    .at(-1);
  const signal = signalsByType[type];
  const now = Date.now();
  const contact = {
    id,
    threadId,
    name,
    owner,
    product: product || "A identificar",
    cents: amount ? parseMoney(amount) : null,
    initials: name
      .split(/\s+/)
      .map((word) => word[0])
      .filter((_, index, words) => index === 0 || index === words.length - 1)
      .join("")
      .toUpperCase(),
    category: signal.title,
    title: signal.title,
    baseline,
    tone: "mint",
    time: "Agora",
    quote: incoming.text,
    before: previous?.text,
    previous: "Trecho importado",
    at: "Leitura de " + timestamp(now),
    why:
      "A leitura local destacou a mensagem de " +
      name +
      " em " +
      channels[channel] +
      ". " +
      signal.next,
    next: signal.next,
    reply: "Olá, " + name.split(" ")[0] + "! " + signal.reply,
  };
  return {
    contact,
    thread: {
      id: threadId,
      contactId: id,
      channel,
      account: "Importação local",
      minutesAgo: 0,
      createdAt: messages.at(-1)?.sentAt ? Date.parse(messages.at(-1).sentAt) : now,
      subject,
      messages: messages.map((m) => ({ ...m, when: m.sentAt ? timestamp(Date.parse(m.sentAt)) : "Trecho importado" })),
    },
  };
}

export function readingOf(ops, contact, thread) {
  const evidence = historyOf(ops, thread)
    .filter((m) => !m.outgoing)
    .at(-1);
  if (evidence?.id) {
    const signal = signalsByType[readSignal(evidence.text)];
    return { ...signal, evidence: evidence.text };
  }
  if (
    contact.id === "clara" &&
    !thread.reply &&
    !ops.products.some(
      (p) =>
        p.name === contact.product &&
        p.stock === "Disponível" &&
        p.price === contact.cents,
    )
  ) {
    return {
      title: "Verificar disponibilidade",
      next: "Confirme o preço e o estoque antes de avisar Clara.",
      reply:
        "Oi, Clara! Vou conferir a disponibilidade e o valor da Oliva e te aviso por aqui.",
      evidence: evidence?.text,
    };
  }
  return {
    title: thread.title || contact.title,
    next: thread.next || contact.next,
    reply: thread.reply || contact.reply,
    evidence: evidence?.text,
  };
}
