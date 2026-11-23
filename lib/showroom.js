import { localDate } from "./inbox";

const stores = [
  "Pinheiros",
  "Vila Madalena",
  "Moema",
  "Campinas",
  "Santos",
  "Curitiba",
  "Batel",
  "Florianópolis",
  "Belo Horizonte",
  "Brasília",
];
const desks = [
  "Showroom",
  "Projetos",
  "Vendas online",
  "Relacionamento",
  "Pós-venda",
];
const firstNames = [
  "Ana",
  "Bruno",
  "Cecília",
  "Daniel",
  "Elisa",
  "Felipe",
  "Giovana",
  "Heitor",
  "Isadora",
  "João",
  "Karina",
  "Luís",
  "Manuela",
  "Nicolas",
  "Olívia",
  "Pedro",
  "Raquel",
  "Samuel",
  "Teresa",
  "Vicente",
  "Yasmin",
  "André",
  "Bianca",
  "Davi",
];
const surnames = [
  "Andrade",
  "Barros",
  "Carvalho",
  "Dias",
  "Freitas",
  "Gomes",
  "Leite",
  "Moura",
  "Nunes",
  "Pires",
  "Ramos",
  "Teixeira",
  "Vieira",
];
function personName(i) {
  return (
    firstNames[i % firstNames.length] +
    " " +
    surnames[(i + Math.floor(i / firstNames.length)) % surnames.length]
  );
}
const designs = [
  "Brisa",
  "Lume",
  "Horizonte",
  "Íris",
  "Maré",
  "Bosque",
  "Alba",
  "Serra",
  "Aroeira",
  "Duna",
];
const models = [
  ["Poltrona", "Estofados", 1890],
  ["Sofá", "Estofados", 3980],
  ["Cadeira", "Assentos", 695],
  ["Banco", "Assentos", 440],
  ["Mesa lateral", "Mesas", 580],
  ["Mesa de jantar", "Mesas", 2180],
  ["Estante", "Organização", 1490],
  ["Aparador", "Organização", 1020],
  ["Luminária", "Iluminação", 370],
  ["Pendente", "Iluminação", 670],
  ["Tapete", "Decoração", 890],
  ["Vaso", "Decoração", 180],
];
function catalog(base) {
  const goods = Array.from({ length: 117 }, (_, i) => {
    const [type, category, price] = models[i % models.length];
    const collection = Math.floor(i / models.length);
    return {
      name: type + " " + designs[collection],
      category,
      kind: "product",
      sku: "AU-" + (101 + i),
      price: (price + collection * 25) * 100,
      stock:
        i % 11 === 2 ? "Esgotado" : i % 7 === 3 ? "Sob consulta" : "Disponível",
    };
  });
  const services = [
    "Consultoria de iluminação",
    "Projeto de interiores",
    "Montagem de mobiliário",
    "Curadoria de peças",
    "Visita técnica",
  ].flatMap((name, i) =>
    ["Residencial", "Comercial", "Corporativo"].map((segment, j) => ({
      kind: "service",
      name: name + " · " + segment,
      sku: "SV-" + (101 + i * 3 + j),
      billingUnit: ["hora", "projeto", "serviço", "projeto", "serviço"][i],
      category: segment,
      price: (180 + i * 100 + j * 75) * 100,
      stock: j === 2 ? "Sob consulta" : "Disponível",
    })),
  );
  const baseCategories = ["Estofados", "Decoração", "Residencial", "Decoração"];
  const featured = base.map((item, i) => ({
    ...item,
    sku: "AC-00" + (i + 1),
    category: baseCategories[i],
    scene: ["clara", "marina", "rafael", "bia"][i],
  }));
  return [...featured, ...goods, ...services];
}

const scenarios = [
  [
    "Intenção de compra",
    "Pedido de link de pagamento",
    "Consegue mandar o link para pagar?",
    "Confira a disponibilidade e envie o link de pagamento.",
  ],
  [
    "Dúvida em aberto",
    "Prazo de entrega em aberto",
    "Vocês conseguem entregar até sexta?",
    "Peça o CEP e confirme a data de entrega.",
  ],
  [
    "Disponibilidade de produto",
    "Cliente aguarda reposição",
    "Quando voltar ao estoque você me avisa?",
    "Confira o estoque da unidade antes de oferecer a reposição.",
  ],
  [
    "Retomada",
    "Proposta em avaliação",
    "Vou avaliar essa proposta com a minha sócia.",
    "Confirme se ainda há dúvidas sobre a proposta.",
  ],
];
export function createShowroom(base) {
  const now = Date.now();
  const products = catalog(base.products);
  const members = [
    ...base.members.map((m, i) => ({
      ...m,
      channel: stores[i],
      email: ["lia", "caio"][i] + "@aurora.example",
    })),
    ...Array.from({ length: 46 }, (_, i) => ({
      name: personName(i),
      channel: stores[i % stores.length],
      active: i % 13 !== 12,
      email:
        personName(i)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(" ", ".")
          .toLowerCase() + "@aurora.example",
    })),
  ];
  const lines = Array.from({ length: 50 }, (_, i) => {
    const branch = stores[i % 10],
      team = members.filter((m) => m.channel === branch && m.active !== false);
    return {
      id: "linha-" + (i + 1),
      name: branch + " · " + desks[Math.floor(i / 10)],
      phone:
        "+55" +
        ["11", "11", "11", "19", "13", "41", "41", "48", "31", "61"][i % 10] +
        (990000100 + i),
      owner: team[Math.floor(i / 10) % team.length].name,
      active: i % 12 !== 11,
      paired: i % 9 !== 6 && i % 13 !== 8,
      pairedAt: i % 13 === 8 ? null : now - 40 * 86400000,
      primaryLine: i === 0,
    };
  });
  const activeLines = lines.filter((l) => l.active && l.paired);
  const imported = [],
    tasks = [],
    events = [],
    outcomes = {},
    threadStars = {},
    stage = {},
    inboxDrafts = {};
  const featured = [0, 1, 3, 2, 4, 9];
  for (let i = 0; i < 236; i++) {
    const id = "cliente-" + (i + 1),
      name = personName(i + 48);
    const channel = ["whatsapp", "instagram", "whatsapp", "email", "whatsapp"][
      i % 5
    ];
    const threadId = id + "-" + channel;
    const line = activeLines[(i * 7 + Math.floor(i / 9)) % activeLines.length];
    // The best sellers recur across stores, while the rest of the catalog forms a long tail.
    const item =
      products[
        i % 4 === 0
          ? featured[Math.floor(i / 4) % featured.length]
          : (i * 37 + Math.floor(i / 8)) % products.length
      ];
    const [category, title, question, next] = scenarios[i % 4];
    const age = i < 32 ? 8 + i * 37 : 1500 + ((i * 433) % (28 * 1440));
    const at = now - age * 60000,
      when = new Date(at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    const before = "Separei os detalhes de " + item.name + " para você.";
    const quote =
      [
        "Sobre " + item.name + ",",
        "Gostei da proposta.",
        "Obrigada pelo retorno.",
        "Acabei de ver.",
      ][i % 4] +
      " " +
      question;
    const contact = {
      id,
      name,
      threadId,
      owner: line.owner,
      product: item.name,
      cents: item.price,
      baseline: i % 4 === 2 ? "lost" : "risk",
      scene: item.scene,
      phone:
        channel === "whatsapp" ? "+55119" + String(82000000 + i) : undefined,
      category,
      title,
      next,
      before,
      quote,
      previous: when,
      at: when,
      time:
        age < 60
          ? age + " min"
          : age < 1440
            ? Math.floor(age / 60) + " h"
            : Math.floor(age / 1440) + " d",
      initials: name
        .split(" ")
        .map((w) => w[0])
        .join(""),
      tone: ["mint", "sand", "lilac"][i % 3],
      why: quote + " " + next,
      reply:
        "Olá, " +
        name.split(" ")[0] +
        "! Podemos retomar a conversa sobre " +
        item.name +
        "?",
    };
    const thread = {
      id: threadId,
      contactId: id,
      channel,
      account:
        channel === "whatsapp"
          ? line.name
          : channel === "email"
            ? "comercial@aurora.example"
            : "@aurora.casa.exemplo",
      lineId: channel === "whatsapp" ? line.id : undefined,
      minutesAgo: age,
      createdAt: at,
      messages: [
        {
          outgoing: true,
          text: before,
          when,
          sentAt: new Date(at - 60000).toISOString(),
        },
        {
          outgoing: false,
          text: quote,
          when,
          sentAt: new Date(at).toISOString(),
        },
      ],
    };
    imported.push({ contact, thread });
    const final = i % 7 === 0 ? "won" : i % 9 === 0 ? "resolved" : null;
    if (final) {
      const detail =
        final === "won"
          ? "Pagamento confirmado pela equipe."
          : "Dúvida esclarecida no atendimento.";
      const replyAt = at + 2 * 60000;
      events.push({
        id: "msg-" + id,
        contact: id,
        threadId,
        channel,
        actor: line.owner,
        owner: line.owner,
        kind: "Resposta simulada",
        at: replyAt,
        detail,
      });
      const event = {
        id: "desfecho-" + id,
        kind: final,
        at: replyAt + 1000,
        contact: id,
        threadId,
        channel,
        owner: line.owner,
        actor: line.owner,
        detail,
        cents: final === "won" ? (item.price ?? 69000) : null,
        recovered: final === "won" && contact.baseline === "lost",
      };
      events.push(event);
      outcomes[id] = { kind: final, at: event.at, cents: event.cents };
    } else if (i % 3 === 0) {
      tasks.push({
        id: "retorno-" + id,
        contact: id,
        threadId,
        owner: line.owner,
        due: localDate((i % 8) - 2),
        text: next,
        done: false,
      });
    }
    stage[id] = ["Proposta", "Follow-up", "Negociação"][i % 3];
    if (!final && i % 31 === 1) inboxDrafts[threadId] = contact.reply;
    if (final && i % 5 === 0)
      tasks.push({
        id: "retorno-feito-" + id,
        contact: id,
        threadId,
        owner: line.owner,
        due: localDate(-Math.floor(age / 1440)),
        text: "Confirmar o retorno com " + name,
        done: true,
      });
    if (i % 17 === 0) threadStars[threadId] = true;
  }
  const usageSamples = [];
  for (let day = 0; day < 30; day++) {
    const date = localDate(-day);
    members.forEach((m, i) => {
      if ((day + i) % 6 === 0 || (m.active === false && day < 8)) return;
      const minutes = 24 + ((day * 13 + i * 37) % 180);
      usageSamples.push({
        day: date,
        actor: m.name,
        minutes,
        focus: Math.floor(minutes / (3 + (i % 4))),
      });
    });
  }
  return {
    ...base,
    profile: {
      ...base.profile,
      name: "Aurora Casa & Design",
      hours: "08:30–19:00",
      website: "https://aurora.example",
      instagram: "@aurora.casa.exemplo",
      email: "comercial@aurora.example",
      phone: "+5511990000100",
      city: "São Paulo",
      state: "SP",
      zip: "05422-000",
      address: "Rua do Ateliê, 240 · Pinheiros",
      cnpj: "AU.ROR.AEX/0001-43",
      about:
        "Rede de móveis e decoração com dez unidades, atendimento digital e projetos sob medida para residências e empresas.",
      facebook: "https://www.facebook.com/aurora.casa.exemplo",
      linkedin: "https://www.linkedin.com/company/aurora-casa-exemplo",
      industry: "Móveis e decoração",
    },
    products,
    members,
    lines,
    imported,
    tasks,
    outcomes,
    stage,
    inboxDrafts,
    events: events.sort((a, b) => b.at - a.at),
    threadStars,
    usageSamples,
    whatsappWelcomed: true,
    sources: { nowz: "Relacionamento", datacrazy: "Vendas da rede" },
  };
}
