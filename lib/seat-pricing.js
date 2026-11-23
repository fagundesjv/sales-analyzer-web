// Proposed commercial terms for the local pricing preview. Money is always in centavos.
export const terms = Object.freeze({
  seatPrice: 25000,
  included: 1000,
  packSize: 250,
  packPrice: 5000,
  setup: 200000,
});
export const aiActions = [
  { id: "message", label: "Análise de mensagem", input: "Mensagens analisadas", credits: 1 },
  {
    id: "diagnosis",
    label: "Diagnóstico de conversa",
    input: "Mensagens na conversa",
    credits: 10,
    blockSize: 20,
  },
  { id: "question", label: "Pergunta à Zoe", input: "Perguntas à Zoe", credits: 5 },
];

export const digits = (n) => n.toLocaleString("pt-BR");
export const lowBalancePercent = 80;
export const cycleKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");

// Older demo directories predate member IDs. Their entries keep their position when edited.
export const seatKey = (member, index) => member.id ?? "legacy-" + index;

export function creditCycle(ops, month) {
  const saved = ops.pricingPreview;
  if (saved?.month === month) return saved;
  const accounts = {};
  if (saved) {
    for (const [key, account] of Object.entries(saved.accounts)) {
      if (!account.endAtRenewal) accounts[key] = { used: 0, packs: 0 };
    }
  } else {
    // Start the preview with the active team. Only known example sellers have sample usage.
    const demoNames = new Set(["Lia", "Caio", ...(ops.usageSamples || []).map((sample) => sample.actor)]);
    ops.members.forEach((member, index) => {
      if (member.active === false) return;
      const demo = !ops.official && [member.name, ...(member.previousNames || [])].some((name) => demoNames.has(name));
      const used = !demo
        ? 0
        : index % 13 === 0
          ? terms.included
          : index % 7 === 1
            ? 910
            : 140 + ((index * 71) % 620);
      accounts[seatKey(member, index)] = { used, packs: 0 };
    });
  }
  return { month, accounts };
}
export function seatBalance(account) {
  const { used = 0, packs = 0 } = account || {};
  const limit = terms.included + packs * terms.packSize;
  const available = limit - used;
  const status = available === 0 ? "empty" : used * 100 >= limit * lowBalancePercent ? "low" : "ok";
  return { used, packs, limit, available, status };
}
export function estimate(seats, packs = 0) {
  const monthly = seats * terms.seatPrice;
  const extras = packs * terms.packPrice;
  return { monthly, extras, ongoing: monthly + extras, first: monthly + extras + terms.setup };
}
export function actionCredits(kind, quantity) {
  const action = aiActions.find((item) => item.id === kind);
  if (!action || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return null;
  return Math.ceil(quantity / (action.blockSize || 1)) * action.credits;
}

// The same check drives the preview and the local commit. Nothing touches live AI or payments.
export function applyCreditAction(cycle, key, kind, quantity) {
  if (!Object.hasOwn(cycle.accounts, key)) return null;
  const balance = seatBalance(cycle.accounts[key]);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return null;
  const account = { ...cycle.accounts[key], used: balance.used, packs: balance.packs };
  if (kind === "pack") {
    account.packs += quantity;
  } else {
    const required = actionCredits(kind, quantity);
    if (required === null || required > balance.available) return null;
    account.used += required;
  }
  return { ...cycle, accounts: { ...cycle.accounts, [key]: account } };
}
