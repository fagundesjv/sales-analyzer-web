"use client";
import { useEffect, useState, useRef } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  ThemeV3,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowRight,
  Check,
  FileText,
  MessageCircle,
  PanelLeft,
  Plug,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { workspaceKey } from "../lib/demo-workspace";
import { readDemo, writeDemo } from "../lib/demo";
import { ProductVisual } from "./product-visual";
import { clearAttachments } from "../lib/attachments";
import { focusUpdate, focusReceipt } from "../lib/focus-round";
import { portalEnabled } from "../lib/official-portal";
import { localUsageReport } from "../lib/usage-report";
import { previewActor } from "../lib/usage-report";
import { WhatsAppPairing } from "./whatsapp-pairing";
import { createReading, compareReading } from "../lib/readings";
import { recoveryQueue } from "../lib/recovery-queue";
import { CustomerInbox } from "./customer-inbox";
import { conversationRequest, evidenceId } from "../lib/conversation-request";
import { readingOf } from "../lib/intake";
import {
  channels,
  historyOf,
  inboxHref,
  primaryThread,
  localDate,
  threadsOf,
  updatesOf,
} from "../lib/inbox";
import { CaseActions, Operation } from "./operations";
import {
  contactsOf,
  destinations,
  freshWorkspace,
  initialOps,
  kinds,
  kindOf,
  money,
  readOps,
  totals,
  writeOps,
} from "../lib/operation";
import skin from "../src/ui/os/os-theme.module.css";
import { RecoveryDesk, ContactMark } from "./recovery-desk";
import { Negotiations } from "./negotiations";
import { opportunityValue } from "../lib/conversation-work";
import { OutcomeCelebration } from "./outcome-celebration";
import { IntegratedSales } from "./v2/integrated-sales";
import { SalesFrame } from "./sales-frame";
import { CommercialDashboard } from "./commercial-dashboard";
import { observeActivity, clearActivity } from "../lib/workspace-activity";
import { ZoeWorkspace } from "./zoe-workspace";
import {
  DetailPage,
  DetailSection,
  DetailText,
  DetailCard,
  DetailRows,
} from "../src/ui/os/detail";

const areas = [
  ["dashboard", "Dashboard", TrendingUp],
  ["radar", "Radar", Radar],
  ["oportunidades", "Negociações", TrendingUp],
  ["entrada", "Caixa de entrada", MessageCircle],
  ["chat", "Chat da Zoe", Sparkles],
  ["operacao", "Operação", PanelLeft],
  ["conexao", "Conectores", Plug],
];
const fold = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
function Zoe({ size = 60 }) {
  return (
    <img
      className="zoe"
      alt="Zoe"
      src="/assets/idle_thumbnail.png"
      width={size}
      height={size}
    />
  );
}
function writeChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function Reading({ s, thread, ops, reviewed, onReview, children }) {
  const reading = readingOf(ops, s, thread);
  const won = kindOf(s, ops) === "won";
  const confirmed = won ? opportunityValue(ops, s) : null;
  const messages = historyOf(ops, thread);
  const lastCustomer = messages.findLastIndex((m) => !m.outgoing);
  const evidence = messages.slice(
    Math.max(0, lastCustomer - 1),
    lastCustomer + 1,
  );
  return (
    <DetailPage
      title={s.name}
      leading={<ContactMark s={s} />}
      status={<Badge>{s.category}</Badge>}
      description={reading.title}
      actions={
        <div className="actions">
          <ButtonLink
            href={inboxHref(thread.id)}
            icon={MessageCircle}
            variant="primary"
          >
            Atender por {channels[thread.channel]}
          </ButtonLink>
          <ButtonLink href={inboxHref(thread.id) + "/plano"} icon={Sparkles}>Ver retomada da Zoe</ButtonLink>
          {!reviewed && <Button variant="ghost" icon={Check} onClick={onReview}>Marcar leitura revisada</Button>}
        </div>
      }
      aside={
        <DetailCard title="Negociação">
          <div className="sales-detail-art">
            <ProductVisual contact={s} />
          </div>
          <DetailRows
            items={[
              { label: "Responsável", value: s.owner },
              { label: "Produto", value: s.product },
              ...(won ? [{
                label: "Valor confirmado",
                value: confirmed == null ? "Sem registro" : money(confirmed),
              }] : []),
              {
                label: "Valor citado",
                value: s.cents == null ? "A apurar" : money(s.cents),
              },
            ]}
          />
        </DetailCard>
      }
    >
      <DetailSection title="Leitura da Zoe">
        <DetailText>
          {thread.id === primaryThread(s) &&
          !updatesOf(ops, thread).some((e) => e.kind === "Mensagem recebida")
            ? s.why
            : reading.next}
        </DetailText>
      </DetailSection>
      <DetailSection title="Conversa de origem" meta={channels[thread.channel]}>
        <div className="sales-transcript">
          {evidence.map((m, i) => (
            <div key={m.id || i}>
              <small>
                {m.outgoing ? m.author || "Equipe" : s.name} · {m.when}
              </small>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      </DetailSection>
      {children}
    </DetailPage>
  );
}
export default function SalesAnalyzer() {
  return process.env.NEXT_PUBLIC_SALES_MODE === "integrated" ? <IntegratedSales /> : <DemoSales />;
}

function DemoSales() {
  const [route, setRoute] = useState("dashboard"),
    [scheme, setScheme] = useState("dark"),
    [state, setState] = useState({ connected: false, saved: {} }),
    [modal, setModal] = useState(null),
    [ops, setOps] = useState(initialOps),
    [search, setSearch] = useState(""),
    [ownerFilter, setOwnerFilter] = useState("Todos"),
    [threads, setThreads] = useState({}),
    [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState(null);
  const signals = contactsOf(ops);
  const priority = recoveryQueue(ops)[0];
  const first = priority?.contact;
  const [path, id] = route.split("/"),
    contact = signals.find(
      (s) =>
        s.id === id ||
        (path === "zoe" && s.id === threads[id]?.at(-1)?.contactId),
    ),
    isDetail = path === "conversa" && contact,
    isThread =
      path === "zoe" && (contact || id === "operacao" || threads[id]?.length);
  const detailThread =
    isDetail &&
    (threadsOf(ops).find(
      (t) => t.contactId === id && t.id === route.split("/")[2],
    ) ||
      threadsOf(ops).find((t) => t.id === primaryThread(contact)));
  const sub = destinations.find((x) => x[0] === path);
  const area = isThread
    ? "chat"
    : sub && path !== "conexao"
      ? "operacao"
      : isDetail
        ? "oportunidades"
        : areas.some((a) => a[0] === path)
          ? path
          : "radar";
  const areaLabel = areas.find((a) => a[0] === area)[1];
  const pageTitle = isDetail ? contact.name : isThread ? "Conversa com a Zoe" : sub?.[1] || areaLabel;
  function navigate(where) {
    location.hash = where;
  }
  useEffect(observeActivity, []);
  const currentOps = useRef(ops);
  function change(delta, event) {
    const before = currentOps.current;
    const next = { ...before, ...(typeof delta === "function" ? delta(before) : delta) };
    if (event) {
      const saved = { actor:previewActor, ...event, id: crypto.randomUUID(), at: Date.now() };
      next.events = [saved, ...before.events];
      if (saved.kind === "Mensagem recebida" && before.zoeReplies?.[saved.threadId]) {
        next.zoeReplies = { ...next.zoeReplies };
        delete next.zoeReplies[saved.threadId];
      }
      if (["won","resolved","Atendimento resolvido"].includes(saved.kind)) setCelebration(saved);
      if (
        next.focus &&
        !next.focus.paused &&
        location.hash.split("/")[0] === "#entrada" &&
        saved.threadId
      ) {
        if (!location.hash.split("/")[2] && saved.kind === "Atendimento iniciado")
          navigate(inboxHref(saved.threadId));
        const kind =
          saved.kind === "Resposta simulada"
            ? "replies"
            : ["won", "lost", "resolved", "Atendimento resolvido"].includes(saved.kind)
              ? "concluded"
              : null;
        if (kind)
          next.focus = focusUpdate(next.focus, {
            type: "action",
            kind,
            now: saved.at,
            id: kind === "replies" ? saved.id : saved.threadId,
          });
        if (saved.kind === "won")
          next.focus = focusUpdate(next.focus, {
            type: "action",
            kind: "won",
            now: saved.at,
            id: saved.id,
            amountCents: saved.cents,
          });
      }
    }
    currentOps.current = next;
    setOps(next);
    try {
      writeOps(next);
    } catch {
      setNotice("Alterações disponíveis apenas nesta sessão.");
    }
  }
  useEffect(() => {
    function signal(type) {
      const f = currentOps.current.focus;
      if (!f || f.paused) return;
      const now = Date.now();
      if (type === "activity" && now - (f.model?.lastInteraction || 0) < 4000)
        return;
      const next = focusUpdate(f, { type, now });
      if (next.model.phase === "completed")
        change(
          {
            focus: null,
            focusHistory: [
              focusReceipt(next),
              ...(currentOps.current.focusHistory || []),
            ],
          },
          { kind: "Rodada concluída", detail: "10 minutos de foco" },
        );
      else change({ focus: next });
    }
    const away = () => signal("away");
    const visibility = () => {
      if (document.hidden) away();
    };
    const interaction = () => {
      if (location.hash.split("/")[0] === "#entrada") signal("activity");
    };
    const navigation = () => {
      if (location.hash.split("/")[0] !== "#entrada") {
        away();
        return;
      }
      const id = location.hash.split("/")[2],
        f = currentOps.current.focus;
      if (f && !f.paused && id && !f.model?.opened.includes(id))
        change({
          focus: focusUpdate(f, {
            type: "action",
            kind: "opened",
            id,
            now: Date.now(),
          }),
        });
    };
    const timer = setInterval(
      () => signal(document.hidden ? "away" : "tick"),
      5000,
    );
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", interaction);
    document.addEventListener("keydown", interaction);
    window.addEventListener("pagehide", away);
    window.addEventListener("hashchange", navigation);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", interaction);
      document.removeEventListener("keydown", interaction);
      window.removeEventListener("pagehide", away);
      window.removeEventListener("hashchange", navigation);
    };
  }, []);
  function store(next) {
    setState(next);
    try {
      writeDemo(next);
    } catch {
      setNotice("Os dados ficam disponíveis somente nesta sessão.");
    }
  }
  useEffect(() => {
    function readRoute() {
      if (["#relatorios","#relatorio-diario","#relatorios-diarios"].includes(location.hash.split("/")[0])) window.history.replaceState(null, "", "#chat");
      if (location.hash.split("/")[0] === "#foco") {
        const suffix = location.hash.slice(5);
        window.history.replaceState(null, "", suffix ? "#entrada" + suffix : "#entrada/rodada");
      }
      if (location.hash === "#ajustes") window.history.replaceState(window.history.state, "", "#empresa");
      if (location.hash === "#operacao")
        window.history.replaceState(null, "", "#radar");
      setRoute(location.hash.slice(1) || "dashboard");
      setModal(null);
    }
    readRoute();
    setState(readDemo());
    currentOps.current = readOps();
    if (readDemo().connected && !(currentOps.current.lines || []).some(line => Object.hasOwn(line,"paired"))) {
      const old = currentOps.current;
      currentOps.current = {...old, lines:[...(old.lines || []), {id:"legacy-commercial",name:"WhatsApp comercial",phone:"",owner:old.members[0]?.name || "",active:true,primaryLine:true,paired:true}]};
      try {writeOps(currentOps.current);} catch { /* Session-only preview. */ }
    }
    setOps(currentOps.current);
    try {
      const h = JSON.parse(localStorage.getItem(workspaceKey("sales-v2-threads")) || "{}");
      if (h && typeof h === "object") setThreads(h);
    } catch {}
    try {
      const saved = localStorage.getItem("sales-v2-theme");
      setScheme(saved === "light" ? "light" : "dark");
    } catch {}
    window.addEventListener("hashchange", readRoute);
    return () => window.removeEventListener("hashchange", readRoute);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);
  function changeTheme() {
    const next = scheme === "light" ? "dark" : "light";
    setScheme(next);
    writeChoice("sales-v2-theme", next);
  }
  function ask(text, preset, attachment, sourceThread) {
    const query = fold(text);
    const lastReading = ops.runs[0];
    const comparison = compareReading(lastReading, ops.runs);
    const destination = destinations.find(
      ([key, label]) => query.includes(fold(label)) || query.includes(key),
    );
    const explicit = (sourceThread && signals.find(s=>s.id===sourceThread.contactId)) || signals.find((s) =>
      query.includes(fold(s.name.split(" ")[0])),
    );
    const target = explicit || (sourceThread !== null && isThread && contact) || first || signals[0];
    const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
    const searchTerm =
      quoted ||
      text
        .match(/(?:busque|buscar|procure|localize)\s+(?:por\s+)?(.+)/i)?.[1]
        ?.trim();
    const waitLimit = Number(query.match(/(\d+)\s*min/)?.[1] || 30);
    const intent =
      preset ||
      (/pedido|promessa|faltou responder|resposta parcial/.test(query)
        ? "request"
        : null) ||
      (searchTerm
        ? "search"
        : /\buso\b|tempo de utilizacao/.test(query)
          ? "usage"
        : /espera|aguarda|sem resposta/.test(query)
          ? "waiting"
          : null) ||
      (/mudou|mudanca|compar[ae]/.test(query)
        ? "changes"
        : /agendar|marcar retorno|programar|criar retorno|preparar retomada/.test(
              query,
            )
          ? "plan"
          : /estoque|reposicao|disponibilidade/.test(query) && !explicit
            ? "stock"
            : /tarefa|retornos|agenda/.test(query)
              ? "tasks"
              : /recuperad|recuperamos|recuperei/.test(query)
                ? "recovered"
                : /conect|fonte|nowz|datacrazy/.test(query)
                  ? "connect"
                  : /diagnostico|raio.x/.test(query)
                    ? "report"
                    : /perd|causa/.test(query)
                      ? "loss"
                      : /ganho|confirmad/.test(query)
                        ? "won"
                        : /risco|valor/.test(query)
                          ? "risk"
                          : /priori|primeir|quem|urgente|recuperar|retomar/.test(
                                query,
                              )
                            ? "priority"
                            : /sinal|evidencia|motivo|pediu|por que|disse/.test(
                                  query,
                                )
                              ? "evidence"
                              : /respost|respond|escrev|rascunho|redigir/.test(
                                    query,
                                  )
                                ? "reply"
                                : explicit
                                  ? "evidence"
                                  : "unknown");
    const s = intent === "priority" ? explicit || first || target : target;
    const requestedChannel = /instagram|direct/.test(query)
      ? "instagram"
      : /e-?mail/.test(query)
        ? "email"
        : /whatsapp|wpp/.test(query)
          ? "whatsapp"
          : null;
    const contactThreads = threadsOf(ops).filter((t) => t.contactId === s.id);
    const sorted = contactThreads.sort(
      (a, b) =>
        (updatesOf(ops, b)[0]?.at || b.createdAt || -b.minutesAgo) -
        (updatesOf(ops, a)[0]?.at || a.createdAt || -a.minutesAgo),
    );
    const channelThread = sourceThread || (requestedChannel
      ? sorted.find((t) => t.channel === requestedChannel)
      : (intent === "priority"
          ? recoveryQueue(ops).find((row) => row.contact.id === s.id)?.thread
          : undefined) ||
        sorted.find(
          (t) =>
            t.id === (route.split("/")[2] || threads[id]?.at(-1)?.threadId),
        ) ||
        sorted[0]);
    const reading = channelThread && readingOf(ops, s, channelThread);
    const request =
      intent === "request" && channelThread
        ? conversationRequest(ops, channelThread)
        : null;
    const searchResults =
      intent === "search"
        ? threadsOf(ops).flatMap((t) => {
            if ((sourceThread && t.id !== sourceThread.id) || (requestedChannel && t.channel !== requestedChannel)) return [];
            const history = historyOf(ops, t);
            const index = history.findLastIndex(m => fold(m.text).includes(fold(searchTerm)));
            if (index < 0) return [];
            const hit = history[index];
            const name = signals.find((c) => c.id === t.contactId)?.name;
            return [{ thread: t, name, evidence: hit.text, messageId: evidenceId(hit, index) }];
          })
        : [];
    const waiting =
      intent === "waiting"
        ? recoveryQueue(ops, { includeScheduled: true }).filter(
            (r) =>
              (!sourceThread || r.thread.id === sourceThread.id) &&
              r.waiting &&
              r.elapsed >= waitLimit &&
              (!requestedChannel || r.thread.channel === requestedChannel),
          )
        : [];
    const matched =
      intent === "waiting"
        ? waiting.map((r) => ({
            thread: r.thread,
            name: r.contact.name,
            evidence: r.delay + " · " + r.quote, rawQuote: r.quote,
          }))
        : searchResults;
    const amounts = totals(ops);
    const losses = signals.filter((x) => kindOf(x, ops) === "lost");
    const usage = intent === "usage" && !portalEnabled ? localUsageReport(ops, threads, 7) : null;
    const paired = (ops.lines || []).filter(line => line.paired).map(line => line.name);
    const sourceNames = [ ...paired, ...[["nowz", "Nowz / Helena"], ["datacrazy", "DataCrazy"]]
      .filter(([key]) => ops.sources[key]).map(([, name]) => name) ];
    let action = {
      priority: channelThread && [
        "Abrir conversa",
        inboxHref(channelThread.id).slice(1),
      ],
      plan: [
        "Ver retomada da Zoe",
        channelThread
          ? inboxHref(channelThread.id).slice(1) + "/plano"
          : "entrada",
      ],
      stock: ["Revisar reposições", "catalogo/reposicao"],
      evidence: channelThread && [
        "Ler conversa no " + channels[channelThread.channel],
        inboxHref(channelThread.id).slice(1),
      ],
      reply: channelThread && [
        "Ver sugestão no atendimento",
        inboxHref(channelThread.id).slice(1) + "/plano",
      ],
      tasks: ["Abrir retornos", "tarefas"],
      connect: ["Abrir conectores", "conexao"],
      usage: ["Conferir atividade", "uso"],
      request: channelThread && [
        "Conferir pedido na conversa",
        inboxHref(channelThread.id).slice(1) + "/plano",
      ],
      changes: [
        "Conferir histórico de leituras",
        lastReading ? "diagnosticos/" + lastReading.id : "diagnosticos",
      ],
      report: ["Abrir diagnósticos", "diagnosticos"],
      loss: ["Ver perdas", "oportunidades/lost"],
      won: ["Conferir ganhos", "resultados"],
      recovered: ["Ver recuperações confirmadas", "resultados"],
      risk: ["Conferir valores em risco", "oportunidades/risk"],
    }[intent];
    if (
      destination &&
      ![
        "changes",
        "usage",
        "stock",
        "tasks",
        "plan",
        "loss",
        "risk",
        "priority",
        "won",
        "recovered",
        "reply",
        "evidence",
      ].includes(intent)
    )
      action = ["Abrir " + destination[1].toLowerCase(), destination[0]];
    const answers = {
      request: request
        ? [
            s.name + " · " + channels[channelThread.channel],
            ...request.itens.map((i) => i.rotulo + " — “" + i.trecho + "”"),
            ...request.compromissos.map(
              (c) => "Compromisso da equipe — “" + c.texto + "”",
            ),
            ...(!request.itens.length && !request.compromissos.length
              ? ["Nenhum pedido em aberto identificado."]
              : []),
          ].join("\n")
        : "Nenhuma conversa neste canal.",
      plan:
        "Preparei uma retomada para " +
        s.name +
        ". Confira a mensagem, o responsável e o prazo antes de confirmar.",
      stock:
        ops.products
          .filter((p) => p.stock === "Disponível")
          .map((p) => p.name + (p.price ? " · " + money(p.price) : ""))
          .join("\n") || "Nenhum produto marcado como disponível no catálogo.",
      tasks:
        ops.tasks
          .filter((t) => !t.done)
          .map(
            (t) =>
              t.text +
              " · " +
              t.owner +
              " · " +
              (t.due === localDate()
                ? "hoje"
                : (t.due || "").split("-").reverse().join("/")),
          )
          .join("\n") || "A equipe está sem retornos pendentes.",
      risk:
        money(amounts.risk) +
        " em valores citados nas conversas ainda em risco. " +
        (amounts.unpriced === 1
          ? "Uma conversa ainda não tem preço informado."
          : amounts.unpriced + " conversas sem preço informado."),
      loss: losses.length
        ? losses
            .map(
              (x) =>
                x.name + " · " + (ops.outcomes[x.id]?.reason || x.title) + ".",
            )
            .join(" ")
        : "Nenhuma venda permanece registrada como perdida.",
      recovered:
        money(amounts.recovered) +
        " em vendas confirmadas após uma perda registrada.",
      won:
        money(amounts.won) +
        " em " +
        amounts.sales.length +
        " venda(s) confirmada(s) na demonstração.",
      connect: portalEnabled
        ? "Em WhatsApps, confira as linhas e o estado do pareamento da sua empresa. Os outros conectores ficam em Ajustes."
        : sourceNames.length
          ? "Fontes conectadas nesta prévia: " + sourceNames.join(", ") + "."
          : "A prévia está usando conversas de exemplo. Abra Conectores para conectar a primeira fonte.",
      usage: usage
        ? "Nos últimos 7 dias, " + usage.name + " registrou " +
          Math.floor(usage.days.reduce((sum, day) => sum + day.usageMs, 0) / 60000) +
          " min de uso e " + usage.days.reduce((sum, day) => sum + day.concluded, 0) +
          " atendimentos concluídos. Em Uso, você pode conferir a atividade por pessoa."
        : "Abra Uso para consultar a atividade que seu perfil pode visualizar no portal da empresa.",
      file: attachment
        ? "Arquivo " +
          attachment.name +
          " · " +
          attachment.lines +
          " linha(s). Trecho do arquivo anexado:\n" +
          attachment.preview
        : "",
      search: matched.length
        ? matched.length + " conversa(s) com o trecho pesquisado."
        : "Nenhuma conversa contém esse trecho no canal escolhido.",
      waiting: matched.length
        ? matched.length +
          " atendimento(s) em recuperação aguardam há pelo menos " +
          waitLimit +
          " minutos."
        : "Nenhum atendimento em recuperação com essa espera.",
      changes: comparison
        ? lastReading.source +
          " · " +
          lastReading.days +
          " dias. " +
          comparison.text +
          " " +
          comparison.changed
            .map((c) => c.name + " · " + kinds[c.status])
            .join(", ")
        : "Para comparar, gere duas leituras da mesma fonte e período em Diagnósticos.",
      report: lastReading
        ? "A última leitura de " + lastReading.source + " analisou " + lastReading.days +
          " dias e identificou " + (lastReading.ids?.length ?? lastReading.records?.length ?? 0) + " negociações." +
          (lastReading.riskCents != null ? " Valor citado em risco: " + money(lastReading.riskCents) + "." : "")
        : "Escolha a fonte e o período em Diagnósticos para gerar a primeira leitura da operação.",
      priority: first
        ? "Comece por " +
          s.name +
          ". " +
          (reading ? reading.evidence + " " + reading.next : s.why)
        : "A fila está em dia. Consulte a agenda para acompanhar os próximos retornos.",
      evidence: reading
        ? s.name +
          " escreveu em " +
          channels[channelThread.channel] +
          ": “" +
          reading.evidence +
          "” " +
          reading.next
        : "Nenhuma conversa desse contato no canal solicitado.",
      reply:
        reading?.reply ||
        "Escolha um canal com histórico para preparar a resposta.",
      unknown:
        "Nesta demonstração, posso indicar quem priorizar, explicar uma mensagem ou preparar uma resposta. Abra Analisar para escolher uma pergunta.",
    };
    const threadKey =
      isThread && threads[id]?.length ? id : "sessao-" + crypto.randomUUID();
    const contextual =
      explicit ||
      (sourceThread !== null && isThread && contact) ||
      (["request", "evidence", "reply", "plan", "priority"].includes(intent)
        ? s
        : null);
    function messageHref(t, quote, id) {
      if (!id && quote) {
        const history = historyOf(ops, t);
        const index = history.findLastIndex(m => m.text === quote);
        if (index >= 0) id = evidenceId(history[index], index);
      }
      return inboxHref(t.id) + (id ? "/mensagem/" + id : "");
    }
    const next = {
      ...threads,
      [threadKey]: [
        ...(threads[threadKey] || []),
        {
          actor:previewActor,
          q: text,
          at: Date.now(),
          contactId: contextual?.id,
          threadId: contextual && channelThread?.id,
          a:
            intent === "unknown" && destination
              ? destination[2] + ". Você pode abrir essa área abaixo."
              : answers[intent],
          action,
          replyDraft: intent === "reply" && reading?.reply ? { threadId: channelThread.id, text: reading.reply } : undefined,
          amounts: intent === "risk" ? signals.filter(c => kindOf(c, ops) === "risk" && c.cents > 0).map(c => ({ name: c.name, value: c.cents, href: "#conversa/" + c.id })).sort((a,b) => b.value - a.value) : undefined,
          evidence:
            ["request", "reply", "evidence", "plan", "priority"].includes(
              intent,
            ) &&
            channelThread &&
            reading
              ? [
                  {
                    href: messageHref(channelThread, reading.evidence),
                    label: s.name + " · " + channels[channelThread.channel],
                    quote: reading.evidence,
                  },
                ]
              : matched.slice(0, 12).map((row) => ({
                  label: row.name + " · " + channels[row.thread.channel],
                  href: messageHref(row.thread, row.rawQuote || row.evidence, row.messageId),
                  quote: row.evidence,
                })),
        },
      ],
    };
    setThreads(next);
    writeChoice(workspaceKey("sales-v2-threads"), JSON.stringify(next));
    navigate("zoe/" + threadKey);
  }
  const start = () => setModal({ kind: "entry" });
  function completePairing(days, alias) {
    const before = currentOps.current;
    const target = modal?.line;
    const existing = (before.lines || []).find(line => line.id === target?.id);
    const primary = !(before.lines || []).some(line => line.primaryLine && line.id !== existing?.id);
    const line = {...(existing || {id:crypto.randomUUID(), phone:"", owner:before.members.find(m=>m.active !== false)?.name || "", active:true}),
      name:alias.trim(), paired:true, pairedAt:Date.now(), primaryLine:existing?.primaryLine ?? primary};
    const lines = existing ? before.lines.map(item=>item.id === line.id ? line : item) : [...before.lines,line];
    const run = createReading({...before,lines}, "linha/" + line.id, days);
    const eligible = new Set(run.records.map(item => item.threadId));
    const next = recoveryQueue(before).find(row => eligible.has(row.thread.id));
    change({ lines, runs: [run, ...before.runs], whatsappWelcomed: true },
      { kind: "Diagnóstico concluído", detail: run.source });
    store({ ...state, connected: true });
    return { run, next, first: !before.whatsappWelcomed };
  }
  function simulateReturn() {
    if (!(currentOps.current.lines || []).some(line => line.paired)) {
      const existing = currentOps.current.lines || [];
      const first = existing.find(line => line.primaryLine) || existing[0];
      const lines = first ? existing.map(line => line.id === first.id ? {...line, paired:true, primaryLine:true, pairedAt:Date.now()} : line)
        : [{id:crypto.randomUUID(), name:"WhatsApp comercial", phone:"", owner:currentOps.current.members[0]?.name || "", active:true, paired:true, primaryLine:true, pairedAt:Date.now()}];
      change({lines});
    }
    store({ ...state, connected: true });
    navigate("radar");
    setNotice("Conexão simulada carregada.");
  }
  const dark = scheme === "dark";
  const titles = {
    entry: "Seu primeiro diagnóstico",
    reset: "Reiniciar demonstração?",
  };
  return (
    <ThemeV3 className={skin.brand} mode={scheme}>
      <title>{pageTitle + " · Sales Analyzer"}</title>
      <ThemeV3 className={skin.mono + " sales-surface"}>
        <SalesFrame
          onReset={() => setModal({ kind: "reset" })}
          route={route}
          area={area}
          title={
            isThread
              ? contact?.name || "Conversa com a Zoe"
              : isDetail
                ? contact.name
                : area === "chat"
                  ? "Nova conversa"
                  : sub?.[1] || areaLabel
          }
          ops={ops}
          threads={threads}
          dark={dark}
          changeTheme={changeTheme}
          ask={ask}
        >
          {isDetail ? (
            <Reading
              thread={detailThread}
              ops={ops}
              s={contact}
              reviewed={Object.hasOwn(state.saved, id)}
              onReview={() => { store({ ...state, saved: { ...state.saved, [contact.id]: "" } }); setNotice("Leitura revisada."); }}
            >
              <CaseActions
                key={id}
                s={contact}
                ops={ops}
                change={change}
                notify={setNotice}
                threadId={detailThread.id}
              />
            </Reading>
          ) : area === "entrada" ? (
            <CustomerInbox
              {...{ route, ops, change }}
              saved={state.saved}
              notify={setNotice}
            />
          ) : area === "chat" ? (
            <ZoeWorkspace
              key={isThread ? id : route}
              thread={!!isThread}
              onStageReply={({threadId, text}) => {
                change(before => ({ zoeReplies: { ...before.zoeReplies, [threadId]: text } }));
                navigate(inboxHref(threadId) + "/plano");
              }}
              sourceThreadId={route.split("/")[2] || threads[id]?.at(-1)?.threadId}
              contact={isThread ? contact : undefined}
              turns={threads[id] || []}
              notify={setNotice}
              onForget={(i) => {
                const next = {
                  ...threads,
                  [id]: threads[id].filter((_, index) => index !== i),
                };
                if (!next[id].length) {
                  delete next[id];
                  navigate("chat");
                }
                setThreads(next);
                writeChoice(workspaceKey("sales-v2-threads"), JSON.stringify(next));
              }}
              priority={priority}
              origin={isThread ? undefined : id}
              ops={ops}
              ask={ask}
              connected={state.connected}
              onStart={start}
              onReturn={simulateReturn}
              onDraft={() => navigate(inboxHref(route.split("/")[2] || threads[id]?.at(-1)?.threadId || primaryThread(contact)) + "/plano")}
            />
          ) : area === "dashboard" ? (
            <CommercialDashboard ops={ops} ask={ask} />
          ) : area === "radar" ? (
            <RecoveryDesk ops={ops} ask={ask} change={change} />
          ) : area === "oportunidades" ? (
            <Negotiations
              ops={ops}
              saved={state.saved}
              route={route}
              search={search}
              setSearch={setSearch}
              owner={ownerFilter}
              setOwner={setOwnerFilter}
            />
          ) : (
            <Operation
              key={path === "diagnosticos" ? route : path}
              route={route}
              saved={state.saved}
              readingId={id}
              view={sub?.[0] || "operacao"}
              threads={threads}
              ops={ops}
              change={change}
              notify={setNotice}
              connected={state.connected}
              onConnect={line => setModal({ kind: "pair", line:line?.id ? line : null })}
              onDisconnect={line => {
                if (!line?.id) return;
                const lines = currentOps.current.lines.map(l => line.id === l.id ? {...l, paired:false} : l);
                store({ ...state, connected: lines.some(l=>l.paired) });
                change(
                  {lines},
                  { kind: "WhatsApp desconectado", detail: line.name },
                );
              }}
            />
          )}
        </SalesFrame>
        {modal?.kind === "pair" && (
          <WhatsAppPairing line={modal.line} company={ops.profile.name} onComplete={completePairing} onClose={() => setModal(null)} />
        )}
        <ResponsiveDialog
          open={!!modal && modal.kind !== "pair"}
          onClose={() => setModal(null)}
          title={titles[modal?.kind] || "Demonstração"}
          size="sm"
        >
          {modal?.kind === "entry" && (
            <div className="flow">
              <Zoe size={44} />
              <p>
                Entre no espaço fictício da Loja Aurora. Vou mostrar qual
                conversa merece sua atenção primeiro.
              </p>
              <Button
                variant="primary"
                onClick={() => {if(portalEnabled){setModal(null);navigate("whatsapps");}else setModal({kind:"pair"});}}
              >
                Entrar na demonstração
              </Button>
            </div>
          )}
          {modal?.kind === "reset" && (
            <div className="flow">
              <p>
                A conexão de exemplo e os rascunhos salvos neste navegador serão
                removidos.
              </p>
              <div className="actions">
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await clearAttachments();
                    } catch {
                      setNotice("Não foi possível limpar os anexos.");
                      return;
                    }
                    const fresh = freshWorkspace();
                    store({ connected: fresh.lines.some(line => line.paired), saved: {} });
                    setThreads({});
                    setSearch("");
                    setOwnerFilter("Todos");
                    clearActivity();
                    change(fresh);
                    writeChoice(workspaceKey("sales-v2-threads"), "{}");
                    setModal(null);
                    navigate("radar");
                  }}
                >
                  Reiniciar
                </Button>
                <Button onClick={() => setModal(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </ResponsiveDialog>
        {celebration && <OutcomeCelebration key={celebration.id} outcome={celebration.kind} />}
        <div role="status" className={notice ? "toast" : "silent"}>
          {notice}
        </div>
      </ThemeV3>
    </ThemeV3>
  );
}
