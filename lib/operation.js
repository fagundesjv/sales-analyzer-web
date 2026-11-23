import { isShowroom, workspaceKey } from "./demo-workspace";
import { createReading } from "./readings";
import { createShowroom } from "./showroom";
import { confirmedSales } from "./confirmed-sales";
import { signals } from "./demo";
export const money = (cents) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: cents % 100 ? 2 : 0,
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const destinations = [
  ["diagnosticos", "Diagnósticos", "Raio-X, perdas e histórico de leituras"],
  ["alertas", "Alertas", "Regras e sinais que exigem atenção"],
  ["entrada/rodada", "Foco da Zoe", "Rodada de recuperação dentro de Conversas"],
  ["tarefas", "Retornos", "Retornos, responsáveis e prazos"],
  ["crm", "Pipeline comercial", "Contatos, propostas e desfechos"],
  ["resultados", "Resultados", "Ganhos confirmados e ações da equipe"],
  [
    "conexao",
    "Conectores",
    "Integrações para conversas, vendas e automação",
  ],
  ["catalogo", "Produtos e serviços", "Preço, disponibilidade e procura"],
  ["equipe", "Equipe", "Quem recebe novas conversas e quais linhas cada pessoa atende."],
  ["empresa", "Empresa", "Perfil, contatos, conexões e rotina da Zoe."],
  ["uso", "Uso", "Atividade, tempo de foco e atendimentos neste espaço."],
  ["whatsapps", "WhatsApps", "Conexões, responsáveis e conversas por linha."],
  ["ajustes", "Ajustes", "Configurações da operação"],
  ["plano", "Plano e créditos", "Mensalidade da equipe e consumo de IA. Demonstração sem cobrança."],
];
export const initialOps = {
  outcomes: {},
  inboxDrafts: {},
  zoeReplies: {},
  noteDrafts: {},
  quickReplies: [],
  draftFiles: {},
  replyReferences: {},
  attendances: {},
  assignments: {},
  imported: [],
  linkedThreads: [],
  stars: [],
  threadStars: {},
  tasks: [],
  events: [],
  runs: [],
  sources: {},
  whatsappWelcomed: false,
  stage: {},
  pipelines: null,
  dealPipelines: {},
  dealFields: {},
  returnCycle: null,
  lines: [],
  members: [
    { name: "Lia", channel: "Loja Aurora" },
    { name: "Caio", channel: "Atendimento comercial" },
  ],
  products: signals.map((s) => ({
    name: s.product,
    price: s.cents,
    stock: s.id === "clara" ? "Disponível" : "Sob consulta",
  })),
  profile: {
    name: "Loja Aurora",
    hours: "09:00–18:00",
    cadence: "60",
    window: "7",
    paused: false,
  },
  alertRules: { risco: true, perda: true },
  seen: [],
  focus: null,
  focusHistory: [],
  focusMinute: null,
};
const key = "sales-analyzer-v2.operations.1";
export function freshWorkspace() {
  if (!isShowroom()) return initialOps;
  const workspace = createShowroom(initialOps);
  workspace.runs = [createReading(workspace, "Caixa de entrada", Number(workspace.profile.window))];
  return workspace;
}
export function readOps() {
  try {
    const saved = localStorage.getItem(workspaceKey(key));
    if (saved) return { ...initialOps, ...JSON.parse(saved) };
    const fresh = freshWorkspace();
    if (isShowroom()) {
      try { writeOps(fresh); } catch { /* Remain usable in memory. */ }
    }
    return fresh;
  } catch {
    return freshWorkspace();
  }
}
export function writeOps(data) {
  localStorage.setItem(workspaceKey(key), JSON.stringify(data));
}
export function activeMembers(ops) {
  return ops.members.filter((member) => member.active !== false);
}
export function updateMember(ops, index, member) {
  const members = [...ops.members];
  if (index < 0) return { members: [...members, member] };
  const old = members[index].name;
  members[index] = member;
  if (old === member.name) return { members };
  members[index] = {...member, previousNames:[...new Set([...(member.previousNames || []),old])].filter(n=>n !== member.name)};
  const assignments = { ...ops.assignments };
  for (const c of contactsOf(ops))
    if (c.owner === old) assignments[c.id] = member.name;
  const renamed = (row) =>
    row.owner === old ? { ...row, owner: member.name } : row;
  return {
    members,
    assignments,
    tasks: ops.tasks.map(renamed),
    lines: (ops.lines || []).map(renamed),
    focus: ops.focus ? renamed(ops.focus) : null,
  };
}
export function contactsOf(ops) {
  return [...signals, ...ops.imported.map((entry) => entry.contact)].map(
    (contact) =>
      ops.assignments[contact.id]
        ? { ...contact, owner: ops.assignments[contact.id] }
        : contact,
  );
}
export function kindOf(s, ops) {
  return ops.outcomes[s.id]?.kind || s.baseline;
}
export const kinds = {
  risk: "Em risco",
  lost: "Perdida",
  won: "Ganha",
  resolved: "Resolvida",
};
export function totals(ops) {
  let risk = 0,
    lost = 0,
    unpriced = 0;
  for (const s of contactsOf(ops)) {
    const k = kindOf(s, ops);
    if (k === "risk") {
      risk += s.cents || 0;
      if (s.cents == null) unpriced++;
    }
    if (k === "lost") lost++;
  }
  const sales = confirmedSales(ops.events);
  return {
    risk,
    lost,
    unpriced,
    recovered: sales
      .filter((s) => s.recovered)
      .reduce((n, s) => n + s.cents, 0),
    won: sales.reduce((sum, s) => sum + s.cents, 0),
    sales,
  };
}
export function parseMoney(value, { allowZero = false, maxCents = 99999999999999 } = {}) {
  const v = value
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  const brazilian = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(v);
  if (!brazilian && !/^\d+\.\d{1,2}$/.test(v)) return null;
  const [whole, fraction = ""] = (
    brazilian ? v.replaceAll(".", "").replace(",", ".") : v
  ).split(".");
  const n = Number(whole + fraction.padEnd(2, "0"));
  return Number.isSafeInteger(n) && (allowZero ? n >= 0 : n > 0) && n <= maxCents ? n : null;
}
export function timestamp(when) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(when));
}
