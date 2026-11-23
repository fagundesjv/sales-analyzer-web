import { isShowroom, workspaceKey } from "./demo-workspace";
export const signals = [
  {
    id: "clara",
    name: "Clara Mendes",
    initials: "CM",
    tone: "mint",
    category: "Reativação",
    title: "Compra perdida por falta de estoque",
    time: "3 dias",
    product: "Poltrona Oliva",
    owner: "Lia",
    cents: 69000,
    baseline: "lost",
    quote: "Vou deixar para depois. Se a Oliva voltar por R$ 690, me avisa?",
    before: "A poltrona Oliva esgotou. Posso te avisar quando chegar.",
    at: "Há 3 dias, 15h22",
    previous: "Há 3 dias, 15h19",
    next: "Confirme o estoque e retome a conversa com a condição que Clara mencionou.",
    why: "Clara desistiu quando a Oliva esgotou e pediu para ser avisada. O catálogo de exemplo voltou a mostrar a peça disponível.",
    reply:
      "Oi, Clara! A poltrona Oliva voltou ao estoque por R$ 690. Você ainda tem interesse? Posso separar uma para você.",
  },
  {
    id: "marina",
    cents: 28000,
    baseline: "risk",
    owner: "Lia",
    product: "Kit de cerâmica",
    name: "Marina Costa",
    initials: "MC",
    tone: "mint",
    category: "Intenção de compra",
    title: "Pedido de link de pagamento",
    icon: "signal",
    time: "42 min",
    quote: "Gostei do kit. Você me manda o link para pagar?",
    before: "O kit com as duas peças fica em R$ 280.",
    at: "10h18",
    previous: "10h12",
    next: "Confirme o kit escolhido e encaminhe o link de pagamento.",
    why: "Marina já conhece o preço e pediu o link. A última mensagem é dela e segue sem resposta há 42 minutos.",
    reply:
      "Oi, Marina! Separei o kit com as duas peças por R$ 280. Aqui está o link de pagamento: [inserir link].",
  },
  {
    id: "rafael",
    cents: 148000,
    baseline: "risk",
    owner: "Caio",
    product: "Consultoria de interiores",
    name: "Rafael Lima",
    initials: "RL",
    tone: "sand",
    category: "Retomada",
    title: "Proposta aguardando retorno",
    icon: "clock",
    time: "1 dia",
    quote: "Vou olhar a proposta com a minha sócia amanhã.",
    before: "A proposta de consultoria que conversamos ficou em R$ 1.480.",
    at: "Ontem, 11h",
    previous: "Ontem, 10h50",
    next: "Retome a conversa e se ofereça para esclarecer dúvidas sobre o escopo.",
    why: "Rafael combinou de avaliar a proposta com a sócia. O dia combinado chegou e ainda não houve outra mensagem.",
    reply:
      "Oi, Rafael! Você e sua sócia conseguiram avaliar a proposta? Posso esclarecer algum ponto do escopo?",
  },
  {
    id: "bia",
    cents: null,
    baseline: "risk",
    owner: "Caio",
    product: "Modelo azul",
    name: "Beatriz Alves",
    initials: "BA",
    tone: "lilac",
    category: "Dúvida em aberto",
    title: "Dúvida sobre o prazo de entrega",
    icon: "chatbox",
    time: "2 h",
    quote: "Se eu pedir hoje, chega até sexta?",
    before: "Temos o modelo azul em estoque.",
    at: "09h00",
    previous: "08h54",
    next: "Peça o CEP para confirmar o prazo antes de prometer a entrega.",
    why: "Beatriz vinculou o pedido à entrega até sexta. A conversa terminou antes da confirmação do prazo.",
    reply:
      "Oi, Beatriz! Me passa o CEP de entrega? Vou verificar se o modelo azul consegue chegar até sexta.",
  },
];
const key = "sales-analyzer-v2.demo.1";
export function readDemo() {
  try {
    const data = JSON.parse(localStorage.getItem(workspaceKey(key)) || "{}");
    const saved = {};
    for (const [id, value] of Object.entries(data?.saved || {}))
      if (typeof value === "string") saved[id] = value;
    return { connected: typeof data?.connected === "boolean" ? data.connected : isShowroom(), saved };
  } catch {
    return { connected: false, saved: {} };
  }
}
export function writeDemo(state) {
  localStorage.setItem(workspaceKey(key), JSON.stringify(state));
}
