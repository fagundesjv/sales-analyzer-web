import { signals } from "./demo";

export const channels = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
};

const whatsappThreads = signals.map((contact, index) => ({
  id: contact.id + "-whatsapp",
  contactId: contact.id,
  channel: "whatsapp",
  account: "WhatsApp comercial",
  minutesAgo: [4320, 42, 1440, 120][index],
  messages: [
    { outgoing: true, text: contact.before, when: contact.previous },
    { outgoing: false, text: contact.quote, when: contact.at },
  ],
}));

export const conversations = [
  ...whatsappThreads,
  {
    id: "bia-instagram",
    contactId: "bia",
    channel: "instagram",
    account: "@beatriz.exemplo",
    minutesAgo: 18,
    messages: [
      {
        outgoing: false,
        text: "Vi o modelo azul nos stories. É o mesmo que te perguntei no WhatsApp?",
        when: "Hoje, 10h32",
      },
      {
        outgoing: true,
        text: "É o mesmo, Beatriz! Posso conferir a entrega para você.",
        when: "Hoje, 10h35",
      },
      {
        outgoing: false,
        text: "Ótimo! Posso retirar na loja na sexta de manhã?",
        when: "Hoje, 10h42",
      },
    ],
    title: "Confirmar a retirada na loja",
    next: "Confira o estoque do modelo azul e o horário de retirada de sexta-feira.",
    reply:
      "Oi, Beatriz! Vou confirmar a disponibilidade do modelo azul para retirada na sexta de manhã e te aviso por aqui.",
  },
  {
    id: "rafael-email",
    contactId: "rafael",
    channel: "email",
    account: "rafael@cliente.example",
    subject: "Proposta de consultoria de interiores",
    minutesAgo: 65,
    messages: [
      {
        outgoing: true,
        text: "Olá, Rafael.\n\nComo combinamos no WhatsApp, o investimento na consultoria é de R$ 1.480. Fico à disposição para revisar o escopo com vocês.\n\nCaio",
        when: "Ontem, 11h15",
      },
      {
        outgoing: false,
        text: "Bom dia, Caio.\n\nMinha sócia gostou da proposta. Você consegue detalhar quantos ambientes estão incluídos?\n\nObrigado,\nRafael",
        when: "Hoje, 09h55",
      },
    ],
    title: "Esclarecer o escopo da proposta",
    next: "Revise quantos ambientes a proposta inclui e responda à dúvida de Rafael e da sócia.",
    reply:
      "Bom dia, Rafael! Vou conferir o escopo da proposta e detalhar para vocês os ambientes incluídos.\n\nCaio",
  },
];

export function inboxHref(threadId, channel = "todos") {
  return "#entrada/" + channel + (threadId ? "/" + threadId : "");
}

export function updatesOf(ops, thread) {
  return ops.events.filter(
    (e) =>
      (e.kind === "Mensagem recebida" && e.threadId === thread.id) ||
      (e.kind === "Resposta simulada" &&
        (e.threadId
          ? e.threadId === thread.id
          : thread.channel === "whatsapp" && e.contact === thread.contactId)),
  );
}

export function historyOf(ops, thread) {
  return [
    ...thread.messages,
    ...updatesOf(ops, thread)
      .reverse()
      .map((e) => ({
        id: e.id,
        sentAt: new Date(e.at).toISOString(),
        outgoing: e.kind === "Resposta simulada",
        text: e.detail,
        attachment: e.attachment,
        attachments: e.attachments,
        replyTo: e.replyTo,
        author: e.author,
        when: new Date(e.at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
  ];
}

export function threadsOf(ops) {
  return [
    ...conversations,
    ...(ops.linkedThreads || []),
    ...ops.imported.map((entry) => entry.thread),
  ];
}

export function primaryThread(contact) {
  return contact.threadId || contact.id + "-whatsapp";
}

export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
