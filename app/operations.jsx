"use client";
import { DirectoryPager, useDirectoryPage } from "./directory";
import { TeamDirectory } from "./team-directory";
import { SettingsViews } from "./settings-views";
import { Boxes, PackageCheck as RestockIcon, ChartNoAxesColumnIncreasing } from "lucide-react";
import { CatalogBrowser } from "./catalog-browser";
import { billingUnit, catalogKind } from "../lib/catalog";
import { PluginMarket } from "./plugin-market";
import { portalEnabled, portalRequest } from "../lib/official-portal";
import { ReaisField, Field } from "./operation-fields";
import { CompanySettings } from "./company-settings";
import { activeMembers, updateMember } from "../lib/operation";
import { Activity as PersistentView, useEffect, useId, useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  PageHeader,
  List,
  ListItem,
  Textarea,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  Layers,
  MessageCircle,
  Package,
  Plug,
  Star,
  Target,
  Users,
} from "lucide-react";
import { isFavorite, toggleFavorite } from "../lib/conversation-work";
import { recoveryQueue } from "../lib/recovery-queue";
import { cycleDates, followupAfterOutcome } from "../lib/follow-up";
import { WorkspaceUsage } from "./workspace-usage";
import { SeatPlan } from "./seat-plan";
import { ProductDemand } from "./product-demand";
import { WhatsAppLines } from "./whatsapp-lines";
import { createReading, compareReading } from "../lib/readings";
import { ReturnsAgenda } from "./returns-agenda";
import { SalesPerformance } from "./sales-performance";
import { CommercialInsights } from "./commercial-insights";
import { RestockRecovery } from "./restock-recovery";
import { SalesPipeline } from "./sales-pipeline";
import { signals } from "../lib/demo";
import { contactsOf } from "../lib/operation";
import {
  channels,
  inboxHref,
  primaryThread,
  localDate,
  threadsOf,
  updatesOf,
} from "../lib/inbox";
import {
  destinations,
  kinds,
  kindOf,
  money,
  parseMoney,
  timestamp,
  totals,
} from "../lib/operation";
import { PageColumn } from "../src/ui/os/page-column";
import { Pills } from "../src/ui/os/pills";
import { ListBar } from "../src/ui/os/list-bar";
import { StatTiles } from "../src/ui/os/stat-tiles";
export function MetricBand({ ops }) {
  const t = totals(ops);
  return (
    <StatTiles
      label="Resumo da operação"
      items={[
        {
          id: "risk",
          label: "Valor em risco",
          value: money(t.risk),
          href: "#oportunidades/risk",
        },
        {
          id: "lost",
          label: "Vendas perdidas",
          value: t.lost,
          href: "#oportunidades/lost",
        },
        {
          id: "won",
          label: "Valor recuperado",
          value: money(t.recovered),
          href: "#resultados",
        },
      ]}
    />
  );
}

export function CaseActions({
  s,
  ops,
  change,
  notify,
  threadId,
  status,
  initialAction = "",
  onDismiss,
  afterResult,
}) {
  const formId = useId();
  const [view, setView] = useState(initialAction),
    [value, setValue] = useState(
      s.cents ? String(s.cents / 100).replace(".", ",") : "",
    ),
    [reason, setReason] = useState(""),
    [owner, setOwner] = useState(s.owner),
    [task, setTask] = useState(initialAction === "task" ? "Retomar a conversa com " + s.name.split(" ")[0] : ""),
    [message, setMessage] = useState("");
  const current = kindOf(s, ops),
    favoriteThread = { id: threadId || primaryThread(s), contactId: s.id },
    favorite = isFavorite(ops, favoriteThread),
    history = ops.events.filter((e) => e.contact === s.id);
  const [useCycle, setUseCycle] = useState(false);
  const [followDate, setFollowDate] = useState(localDate(1));
  const [finishTasks, setFinishTasks] = useState(true);
  const [scheduleAfter, setScheduleAfter] = useState(false);
  const later = followupAfterOutcome.filter(
    (rule) => rule.outcome === status && ops.returnCycle?.later?.[rule.id],
  );
  function closeView() {
    setView("");
    onDismiss?.();
  }
  function result() {
    const cents = status === "won" ? parseMoney(value) : null;
    if ((status === "won" && !cents) || (status === "lost" && !reason.trim()))
      return;
    const previousSale = history.find((event) =>
      ["won", "lost"].includes(event.kind),
    );
    change(
      {
        ...(afterResult && ops.focus && threadId
          ? {
              focus: {
                ...ops.focus,
                handled: [...new Set([...(ops.focus.handled || []), threadId])],
              },
            }
          : {}),
        tasks: [
          ...(finishTasks && ["won", "resolved", "lost"].includes(status)
            ? ops.tasks.map((t) =>
                t.contact === s.id && !t.done ? { ...t, done: true } : t,
              )
            : ops.tasks),
          ...(scheduleAfter
            ? later.map((rule) => ({
                id: crypto.randomUUID(),
                contact: s.id,
                threadId: threadId || primaryThread(s),
                owner: s.owner,
                due: localDate(ops.returnCycle.later[rule.id].days),
                done: false,
                text: rule.label + " · " + s.name,
              }))
            : []),
        ],
        outcomes: {
          ...ops.outcomes,
          [s.id]: { kind: status, cents, reason: reason.trim() },
        },
      },
      {
        kind: status,
        owner: s.owner,
        threadId,
        recovered:
          status === "won" && (previousSale?.kind ?? s.baseline) === "lost",
        contact: s.id,
        cents,
        detail: reason.trim() || kinds[status],
      },
    );
    closeView();
    notify(status === "won" ? "Venda ganha · " + money(cents) : status === "resolved" ? "Atendimento resolvido." : "Desfecho registrado.");
    afterResult?.();
  }
  return (
    <>
      {!onDismiss && (
        <section className="case-work">
          <h2>Acompanhamento</h2>
          <div className="actions">
            <Badge>{kinds[current]}</Badge>
            <Button
              size="sm"
              icon={Star}
              aria-pressed={favorite}
              onClick={() =>
                change((before) => toggleFavorite(before, favoriteThread))
              }
            >
              {favorite ? "Favorita" : "Favoritar"}
            </Button>
            <Button
              size="sm"
              icon={CalendarClock}
              onClick={() => {
                setTask("Retomar a conversa com " + s.name.split(" ")[0]);
                setView("task");
              }}
            >
              Agendar retorno
            </Button>
            <Button
              size="sm"
              icon={Users}
              onClick={() => {
                setOwner(s.owner);
                setView("assign");
              }}
            >
              Atribuir responsável
            </Button>
            <Button
              size="sm"
              icon={FileText}
              onClick={() => {
                setMessage("");
                setView("note");
              }}
            >
              Nota interna
            </Button>
            {!threadId && (
              <ButtonLink
                size="sm"
                href={inboxHref(primaryThread(s))}
                icon={MessageCircle}
              >
                Abrir atendimento
              </ButtonLink>
            )}
          </div>
          {history.length > 0 && (
            <ul className="event-list">
              {history.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <small>{timestamp(e.at)}</small>
                  <span>
                    {kinds[e.kind] || e.kind}
                    {e.cents ? " · " + money(e.cents) : ""}
                    {e.detail && e.detail !== kinds[e.kind]
                      ? " · " + e.detail
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <ResponsiveDialog
        open={!!view}
        onClose={() => closeView()}
        description={
          view === "outcome" ? s.name + " · " + s.product : undefined
        }
        footer={
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={
              (view === "assign" && owner === s.owner) ||
              (view === "note" && !message.trim()) ||
              (view === "task" && (!task.trim() || !followDate)) ||
              (view === "outcome" &&
                (status === current ||
                  (status === "won" && !parseMoney(value)) ||
                  (status === "lost" && !reason.trim())))
            }
          >
            {view === "task"
              ? "Salvar retorno"
              : view !== "outcome"
                ? "Salvar"
                : status === "won"
                  ? "Confirmar ganho"
                  : status === "lost"
                    ? "Confirmar perda"
                    : "Confirmar reabertura"}
          </Button>
        }
        title={
          view === "assign"
            ? "Atribuir responsável"
            : view === "note"
              ? "Nota interna"
              : view === "task"
                ? "Agendar retorno"
                : status === "won"
                  ? "Venda ganha"
                  : status === "lost"
                    ? "Venda perdida"
                    : "Reabrir negociação"
        }
        size="sm"
      >
        {view === "assign" || view === "note" ? (
          <form
            id={formId}
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (view === "assign")
                change(
                  { assignments: { ...ops.assignments, [s.id]: owner } },
                  {
                    kind: "Responsável alterado",
                    contact: s.id,
                    detail: owner,
                    threadId,
                  },
                );
              else if (message.trim())
                change(
                  {},
                  {
                    kind: "Nota interna",
                    contact: s.id,
                    detail: message.trim(),
                    threadId,
                  },
                );
              if (view === "assign")
                notify("Atendimento atribuído a " + owner + ".");
              closeView();
            }}
          >
            {view === "assign" ? (
              <Field label="Pessoa responsável">
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  {[
                    ...new Set([
                      s.owner,
                      ...activeMembers(ops).map((m) => m.name),
                    ]),
                  ].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Observação para a equipe">
                <Textarea
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
            )}
          </form>
        ) : view === "outcome" ? (
          <form
            id={formId}
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              result();
            }}
          >
            {status === "risk" && (
              <div className="reopen-summary">
                <span>
                  {kinds[current]} <ArrowRight size={14} /> Em risco
                </span>
                <p>
                  A negociação volta para a fila de recuperação da equipe. O
                  histórico dos desfechos anteriores continua disponível.
                </p>
              </div>
            )}
            {status === "won" && (
              <Field label="Valor confirmado da venda (R$)">
                <ReaisField required value={value} onValueChange={setValue} aria-label="Valor confirmado da venda (R$)" />
              </Field>
            )}
            {status === "lost" && (
              <Field label="Motivo da perda">
                <Textarea
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="O que impediu o fechamento?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            {status !== "risk" &&
              ops.tasks.some((t) => t.contact === s.id && !t.done) && (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={finishTasks}
                    onChange={(e) => setFinishTasks(e.target.checked)}
                  />{" "}
                  Concluir os retornos em aberto deste contato
                </label>
              )}
            {!!later.length && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={scheduleAfter}
                  onChange={(e) => setScheduleAfter(e.target.checked)}
                />
                Agendar{" "}
                {later
                  .map(
                    (rule) =>
                      rule.label.toLowerCase() +
                      " em " +
                      ops.returnCycle.later[rule.id].days +
                      " dias",
                  )
                  .join(" e ")}
              </label>
            )}
          </form>
        ) : view === "task" ? (
          <form
            id={formId}
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              const due = new FormData(e.currentTarget).get("due");
              if (!due || !task.trim()) return;
              const dates =
                useCycle && ops.returnCycle
                  ? cycleDates(due, ops.returnCycle.days)
                  : [due];
              change(
                (before) => ({
                  tasks: [
                    ...before.tasks,
                    ...dates.map((date, index) => ({
                      id: crypto.randomUUID(),
                      text:
                        dates.length > 1
                          ? task.trim() +
                            " · " +
                            (index + 1) +
                            "/" +
                            dates.length
                          : task.trim(),
                      owner,
                      due: date,
                      threadId,
                      contact: s.id,
                      done: false,
                    })),
                  ],
                }),
                {
                  kind: "Retorno agendado",
                  threadId: threadId || primaryThread(s),
                  contact: s.id,
                  detail: task.trim(),
                },
              );
              closeView();
              notify("Retorno adicionado às tarefas.");
            }}
          >
            <Field label="Ação">
              <input
                required
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </Field>
            <Field label="Responsável">
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {[
                  ...new Set([
                    s.owner,
                    ...activeMembers(ops).map((m) => m.name),
                  ]),
                ].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input
                required
                type="date"
                name="due"
                value={followDate}
                onChange={(e) => setFollowDate(e.target.value)}
              />
              <span className="follow-presets">
                {[
                  [0, "Hoje"],
                  [1, "Amanhã"],
                  [7, "Em uma semana"],
                ].map(([days, label]) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={followDate === localDate(days)}
                    onClick={() => setFollowDate(localDate(days))}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </Field>
            {ops.returnCycle?.days?.length > 0 && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={useCycle}
                  onChange={(e) => setUseCycle(e.target.checked)}
                />
                Usar ciclo da equipe (
                {ops.returnCycle.days.map((day) => "D+" + day).join(", ")})
              </label>
            )}
            {useCycle && followDate && (
              <small>
                {cycleDates(followDate, ops.returnCycle.days)
                  .map((date) => date.split("-").reverse().join("/"))
                  .join(" · ")}
              </small>
            )}
          </form>
        ) : null}
      </ResponsiveDialog>
    </>
  );
}
const sources = [
  [
    "whatsapp",
    "WhatsApp por QR Code",
    "Leitura e atendimento",
    "Histórico disponível no WhatsApp comercial.",
  ],
  [
    "nowz",
    "Nowz / Helena",
    "Leitura e atendimento",
    "Selecione um canal de atendimento para a leitura da Zoe.",
  ],
  [
    "datacrazy",
    "DataCrazy",
    "Consulta de conversas",
    "Consulte uma instância de exemplo. As mensagens desta fonte ficam fora da análise da Zoe.",
  ],
];
function Connectors({
  route,
  ops,
  change,
  connected,
  onConnect,
}) {
  const [sel, setSel] = useState(null),
    [channel, setChannel] = useState("Comercial"),
    [reader, setReader] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [portalConnected, setPortalConnected] = useState(null);
  useEffect(() => {
    if (!portalEnabled) return;
    const control = new AbortController();
    portalRequest("/api/portal", {signal:control.signal})
      .then(data => {if (!control.signal.aborted) setPortalConnected(data.connections.some(line => line.source !== "nowz" && line.connected));})
      .catch(() => { /* The line manager shows the connection or access error. */ });
    return () => control.abort();
  }, []);
  const active = k => k === "whatsapp" ? (portalEnabled ? portalConnected : connected) : !!ops.sources[k];
  return (<>
      <PluginMarket route={route} active={active} onOpen={k=>{
        if (k === "whatsapp") {
          if (portalEnabled || connected) location.hash = "whatsapps";
          else onConnect();
          return;
        }
        setSel(k); setReader(false); setChannel(ops.sources[k] || "Comercial");
      }}/>
      <ResponsiveDialog
        open={sel !== null}
        onClose={() => setSel(null)}
        title={sources.find((x) => x[0] === sel)?.[1] || "Conector"}
        size="sm"
      >
        <div className="flow">
          <p>{sources.find((x) => x[0] === sel)?.[3]}</p>
          <Badge>Simulação local</Badge>
          {active(sel) ? (
            <>
              <p>
                Canal · {ops.sources[sel]}
              </p>
              {sel === "datacrazy" ? (
                <Button onClick={() => setReader(!reader)}>
                  Consultar conversa de exemplo
                </Button>
              ) : (
                <ButtonLink
                  variant="primary"
                  href="#diagnosticos"
                  onClick={() => setSel(null)}
                >
                  Abrir diagnósticos
                </ButtonLink>
              )}
              {reader && (
                <blockquote className="sample-msg">
                  Contato de exemplo · “Vocês atendem aos sábados?”
                </blockquote>
              )}
              <Button
                onClick={() => {
                  setDisconnecting(sel);
                  setSel(null);
                }}
              >
                Desconectar na demonstração
              </Button>
            </>
          ) : (
            <>
              <Field label="Canal fictício">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option>Comercial</option>
                  <option>Atendimento</option>
                </select>
              </Field>
              <Button
                variant="primary"
                onClick={() => {
                  change(
                    { sources: { ...ops.sources, [sel]: channel } },
                    {
                      kind: "Fonte conectada",
                      detail: sources.find((x) => x[0] === sel)[1],
                    },
                  );
                }}
              >
                Conectar canal de exemplo
              </Button>
            </>
          )}
        </div>
      </ResponsiveDialog>
      {disconnecting && <ConfirmDialog open tone="danger"
        title={"Desconectar " + sources.find(([key]) => key === disconnecting)[1] + "?"}
        description="A fonte ficará disponível para reconexão. As conversas e os diagnósticos já salvos continuam acessíveis."
        confirmLabel="Desconectar fonte" onClose={() => setDisconnecting(null)}
        onConfirm={() => {
          change(before => {
            const sources = { ...before.sources };
            delete sources[disconnecting];
            return { sources };
          });
        }} />}
    </>
  );
}
function reportRisk(run) {
  if (run.riskCents != null) return run.riskCents;
  return signals
    .filter((s) => run.ids.includes(s.id) && s.baseline === "risk")
    .reduce((total, s) => total + (s.cents || 0), 0);
}
function reportText(run) {
  const cases = run.records || signals.filter((s) => run.ids.includes(s.id));
  return [
    run.name,
    run.source + " · " + run.days + " dias · leitura local",
    money(reportRisk(run)) + " em cotações em risco.",
    ...cases.map((s) => [s.name + " · " + s.title, s.quote, s.next].join("\n")),
  ].join("\n\n");
}
function exportReport(run) {
  const url = URL.createObjectURL(
    new Blob([reportText(run)], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "raio-x-" + run.id + ".txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printReport(run) {
  const frame = document.createElement("iframe");
  frame.title = "Impressão do diagnóstico";
  frame.style.cssText =
    "position:fixed;inset:auto 0 0 auto;width:1px;height:1px;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.documentElement.lang = "pt-BR";
  doc.title = run.name;
  const style = doc.createElement("style");
  style.textContent =
    "@page{margin:18mm}body{font:12pt/1.55 system-ui;color:#121212}p{white-space:pre-wrap;break-inside:avoid}h1{font-size:24pt}small{color:#555}";
  doc.head.append(style);
  const brand = doc.createElement("small");
  brand.textContent = "Sales Analyzer";
  const heading = doc.createElement("h1");
  heading.textContent = run.name;
  doc.body.append(brand, heading);
  for (const part of reportText(run).split("\n\n").slice(1)) {
    const p = doc.createElement("p");
    p.textContent = part;
    doc.body.append(p);
  }
  frame.contentWindow.addEventListener(
    "afterprint",
    () => setTimeout(() => frame.remove(), 0),
    { once: true },
  );
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
function Diagnostics({ ops, change, readingId }) {
  const [source, setSource] = useState("Caixa de entrada"),
    [days, setDays] = useState("7"),
    [selected, setSelected] = useState(
      ops.runs.find((r) => r.id === readingId) || null,
    );
  const sample = {
    id: "amostra",
    name: "Raio-X da Loja Aurora",
    source: "Amostra de WhatsApp",
    days: 7,
    ids: signals.map((s) => s.id),
  };
  const available = [
    "Caixa de entrada",
    ...Object.values(channels),
    ...(ops.lines || []).map((l) => "linha/" + l.id),
    ...(ops.sources.nowz ? ["Nowz"] : []),
  ];
  const entries = [...ops.runs, sample];
  const comparison = compareReading(selected, ops.runs);
  function generate(source, days) {
    const run = createReading(ops, source, days);
    change(
      { runs: [run, ...ops.runs] },
      { kind: "Diagnóstico concluído", detail: run.source },
    );
    setSelected(run);
  }
  return (
    <>
      <section className="source-card">
        <h2>Nova leitura</h2>
        <p>
          Escolha a fonte e a janela de análise. O diagnóstico usa as mensagens
          disponíveis neste navegador. Cada oportunidade entra uma vez no valor
          em risco.
        </p>
        {available.length ? (
          <div className="op-form">
            <Field label="Fonte">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {available.map((x) => (
                  <option key={x} value={x}>
                    {x.startsWith("linha/")
                      ? "WhatsApp · " +
                        ops.lines.find((l) => x === "linha/" + l.id)?.name
                      : x}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Período">
              <select value={days} onChange={(e) => setDays(e.target.value)}>
                {[7, 15, 30, 60, 90].map((n) => (
                  <option value={n} key={n}>
                    {n} dias
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="primary" onClick={() => generate(source, days)}>
              Gerar diagnóstico
            </Button>
          </div>
        ) : (
          <ButtonLink href="#conexao">Escolher conector</ButtonLink>
        )}
      </section>
      <h2>Histórico de diagnósticos</h2>
      <List label="Histórico">
        {entries.map((r) => (
          <ListItem
            key={r.id}
            icon={FileText}
            title={r.name}
            description={
              r.source +
              " · " +
              r.days +
              " dias · " +
              (r.at ? timestamp(r.at) : "Leitura de exemplo")
            }
            onClick={() => setSelected(r)}
          />
        ))}
      </List>
      <ResponsiveDialog
        open={!!selected}
        title={selected?.name || "Raio-X"}
        onClose={() => setSelected(null)}
      >
        <div className="flow">
          <p>
            {selected?.source} · {selected?.days} dias ·{" "}
            {selected?.conversationCount ?? selected?.ids.length}{" "}
            {(selected?.conversationCount ?? selected?.ids.length) === 1
              ? "conversa"
              : "conversas"}{" "}
            · {selected?.ids.length}{" "}
            {selected?.ids.length === 1 ? "oportunidade" : "oportunidades"}
          </p>
          {selected && (
            <>
              <p>
                <strong>{money(reportRisk(selected))}</strong> em cotações em
                risco nesta leitura. Conversas sem preço identificado ficam fora
                da soma.
              </p>
              {selected.at && (
                <>
                  <h3>O que mudou</h3>
                  <p>
                    {comparison
                      ? comparison.text
                      : "Primeira leitura desta fonte e período. Atualize após uma ação para comparar."}
                  </p>
                  {comparison && (
                    <small>
                      Comparado com {timestamp(comparison.previous.at)}
                    </small>
                  )}
                  {comparison?.changed.map((c) => (
                    <p key={c.id}>
                      {c.name} ·{" "}
                      {
                        kinds[
                          comparison.previous.records.find((p) => p.id === c.id)
                            .status
                        ]
                      }{" "}
                      → {kinds[c.status]}
                    </p>
                  ))}
                  <Button
                    size="sm"
                    onClick={() =>
                      generate(
                        selected.sourceKey || selected.source,
                        selected.days,
                      )
                    }
                  >
                    Atualizar leitura
                  </Button>
                </>
              )}
              <h3>Evidências da leitura</h3>
            </>
          )}
          {(selected?.records || signals)
            .filter((s) => selected?.ids.includes(s.id))
            .map((s) => (
              <div key={s.id} className="zoe-evidence">
                <blockquote>{s.quote}</blockquote>
                <ButtonLink
                  variant="ghost"
                  href={inboxHref(s.threadId || primaryThread(s))}
                  onClick={() => setSelected(null)}
                  trailingIcon={ArrowRight}
                >
                  {s.name} · {s.category}
                </ButtonLink>
              </div>
            ))}
          {selected && (
            <div className="actions">
              <Button onClick={() => printReport(selected)}>
                Imprimir ou salvar PDF
              </Button>
              <Button onClick={() => exportReport(selected)} icon={FileText}>
                Exportar resumo
              </Button>
            </div>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
function Office({ view, route, ops, change, notify }) {
  const [name, setName] = useState(""),
    [extra, setExtra] = useState(""),
    [edit, setEdit] = useState(-1),
    [stock, setStock] = useState("Sob consulta"),
    [form, setForm] = useState(false);
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [category,setCategory] = useState("");
  const [kind,setKind] = useState("product");
  const [itemKind,setItemKind] = useState("product");
  const [unit,setUnit] = useState("unidade");
  const [sku,setSku] = useState("");
  const team = view === "equipe";
  const data = team ? ops.members : ops.products;
  const duplicateName = team && data.some((member, i) =>
    i !== edit && member.name.trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR"));
  const demand = new Map();
  if (!team && view === "catalogo")
    for (const contact of contactsOf(ops)) {
      const product = contact.product.trim().toLocaleLowerCase("pt-BR");
      if (!demand.has(product)) demand.set(product, []);
      demand.get(product).push(contact);
    }
  const interested =
    demand.get(data[edit]?.name.trim().toLocaleLowerCase("pt-BR")) || [];
  function open(i) {
    const type = data[i] ? catalogKind(data[i]) : kind;
    setItemKind(type); setUnit(data[i] ? billingUnit(data[i]) : type==="service" ? "serviço" : "unidade"); setSku(data[i]?.sku || "");
    setCategory(data[i]?.category || "");
    setEmail(data[i]?.email || "");
    setActive(data[i]?.active !== false);
    setStock(data[i]?.stock || "Sob consulta");
    setEdit(i);
    setName(data[i]?.name || "");
    setExtra(
      team
        ? data[i]?.channel || ""
        : data[i]?.price != null
          ? String(data[i].price / 100).replace(".", ",")
          : "",
    );
    setForm(true);
  }
  return (
    <>
      {team ? (
        <TeamDirectory members={ops.members} lines={ops.lines} onEdit={open} />
      ) : (
        <div className="settings-task">
          <SettingsViews label="Áreas do catálogo" base="catalogo" current={route.split("/")[1]}
            views={[[ "", "Catálogo", Boxes ], ["reposicao", "Reposição", RestockIcon], ["procura", "Procura", ChartNoAxesColumnIncreasing]]} />
          <PersistentView mode={["reposicao", "procura"].includes(route.split("/")[1]) ? "hidden" : "visible"}>
            <CatalogBrowser data={data} demand={demand} kind={kind} onKind={setKind} onEdit={open} />
          </PersistentView>
          {route.split("/")[1] === "reposicao" && <RestockRecovery {...{ ops, change, notify }} />}
          {route.split("/")[1] === "procura" && <ProductDemand ops={ops} />}
        </div>
      )}
      <ResponsiveDialog
        footer={
          <Button
            form="cadastro-operacao"
            variant="primary"
            type="submit"
            disabled={
              !name.trim() ||
              (team && (!extra.trim() || duplicateName)) ||
              (!team && !!extra && !parseMoney(extra))
            }
          >
            {" "}
            Salvar{" "}
          </Button>
        }
        open={form}
        onClose={() => setForm(false)}
        title={
          team
            ? edit === -1
              ? "Adicionar vendedor"
              : "Editar vendedor"
            : (edit === -1 ? "Adicionar " : "Editar ") + (itemKind === "service" ? "serviço" : "produto")
        }
        size="sm"
      >
        <form
          id="cadastro-operacao"
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || (team && (duplicateName || !extra.trim()))) return;
            const item = team
              ? {
                  ...data[edit],
                  name: name.trim(),
                  channel: extra.trim(),
                  email: email.trim(),
                  active,
                }
              : {
                  ...data[edit],
                  name: name.trim(),
                  price: extra ? parseMoney(extra) : null,
                  kind:itemKind, billingUnit:unit, sku:sku.trim(), category:category.trim(), stock,
                };
            const next = [...data];
            if (edit === -1) next.push(item);
            else next[edit] = item;
            change(team ? updateMember(ops, edit, item) : { products: next });
            if (!team) setKind(itemKind);
            setForm(false);
          }}
        >
          {!team && edit >= 0 && (
            <details className="sales-demand">
              <summary>
                Quem procurou este {itemKind === "service" ? "serviço" : "produto"} ({interested.length})
              </summary>
              {interested.length ? (
                interested.map((contact) => (
                  <ButtonLink
                    key={contact.id}
                    size="sm"
                    variant="ghost"
                    href={inboxHref(primaryThread(contact))}
                    onClick={() => setForm(false)}
                  >
                    {contact.name} · {kinds[kindOf(contact, ops)]}
                  </ButtonLink>
                ))
              ) : (
                <p>Nenhuma oportunidade vinculada a este item.</p>
              )}
            </details>
          )}
          <Field label="Nome">
            <input
              required
              value={name}
              autoComplete={team ? "name" : "off"}
              maxLength={70}
              aria-invalid={duplicateName || undefined}
              aria-describedby={duplicateName ? "seller-name-error" : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {duplicateName && <small id="seller-name-error" className="field-error" role="alert">Já existe um vendedor com esse nome.</small>}
          {team && (
            <>
              <Field label="E-mail do vendedor">
                <input
                  type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Disponível para novas atribuições
              </label>
            </>
          )}
          {!team && <>
            <Field label="Tipo"><select value={itemKind} onChange={e=>{setItemKind(e.target.value); setUnit(e.target.value === "service" ? "serviço" : "unidade");setStock("Sob consulta");}}>
              <option value="product">Produto</option><option value="service">Serviço</option></select></Field>
            <Field label="Categoria"><input value={category} maxLength={60} onChange={e=>setCategory(e.target.value)} list="catalog-categories" /><datalist id="catalog-categories">{[...new Set(data.filter(p=>catalogKind(p) === itemKind).map(p=>p.category).filter(Boolean))].map(g=><option key={g} value={g}/>)}</datalist></Field>
            <Field label="Código do catálogo"><input value={sku} maxLength={60} onChange={e=>setSku(e.target.value)} placeholder="Opcional" /></Field>
            {itemKind === "service" && <Field label="Unidade de cobrança"><select value={unit} onChange={e=>setUnit(e.target.value)}>{["serviço","hora","projeto","mês"].map(v=><option key={v}>{v}</option>)}</select></Field>}
          </>}
          {!team && (
            <Field label="Disponibilidade">
              <select value={stock} onChange={(e) => setStock(e.target.value)}>
                {(itemKind === "service" ? ["Disponível", "Sob consulta", "Indisponível"] : ["Disponível","Sob consulta","Esgotado"]).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label={team ? "Canal atribuído" : "Preço em reais"}>
            {team ? <input required value={extra} onChange={e => setExtra(e.target.value)} /> :
              <ReaisField aria-label="Preço em reais" value={extra} onValueChange={setExtra} />}
          </Field>
        </form>
      </ResponsiveDialog>
    </>
  );
}
export function Operation({
  threads,
  view,
  route,
  saved,
  readingId,
  ops,
  change,
  notify,
  connected,
  onConnect,
  onDisconnect,
}) {
  const title = destinations.find((x) => x[0] === view) || [
    "operacao",
    "Operação comercial",
    "Controle as leituras, fontes e rotinas da equipe.",
  ];
  const [resultDays, setResultDays] = useState(7);
  const signals = contactsOf(ops);
  const t = totals(ops);
  const alerts = signals.filter((s) =>
    kindOf(s, ops) === "lost"
      ? ops.alertRules.perda
      : kindOf(s, ops) === "risk" && ops.alertRules.risco,
  );
  const recent = ops.events.filter(
    (e) => Date.now() - e.at < resultDays * 86400000,
  );
  const list = useDirectoryPage(view === "alertas" ? alerts : recent);
  if (view === "crm") return <SalesPipeline ops={ops} change={change} />;
  return (
    <PageColumn>
      <PageHeader title={title[1]} description={["catalogo", "plano"].includes(view) ? undefined : title[2]}
        actions={view === "uso" && !portalEnabled ? <ButtonLink variant="secondary" href="#plano/vendedores">Ver créditos de IA</ButtonLink> : undefined} />
      {view === "conexao" ? (
        <Connectors
          {...{ route, ops, change, connected, onConnect, onDisconnect }}
        />
      ) : view === "uso" ? (
        <WorkspaceUsage ops={ops} threads={threads}/>
      ) : view === "plano" ? (
        <SeatPlan key={route} {...{ ops, threads, change, route }} />
      ) : view === "whatsapps" ? (
        <WhatsAppLines {...{route,ops,change,onConnect,onDisconnect}} />
      ) : view === "diagnosticos" ? (
        <Diagnostics {...{ ops, change, readingId }} />
      ) : view === "empresa" ? (
        <CompanySettings {...{ops, change, notify}} />
      ) : ["equipe", "catalogo"].includes(view) ? (
        <Office {...{ view, route, ops, change, notify }} />
      ) : view === "tarefas" ? (
        <ReturnsAgenda ops={ops} change={change} />
      ) : view === "alertas" ? (
        <>
          <div className="source-card">
            <h2>Regras de alerta</h2>
            {[
              ["risco", "Avisar sobre venda em risco"],
              ["perda", "Avisar sobre perda identificada"],
            ].map(([k, l]) => (
              <label className="check-row" key={k}>
                <input
                  type="checkbox"
                  checked={ops.alertRules[k]}
                  onChange={(e) =>
                    change({
                      alertRules: { ...ops.alertRules, [k]: e.target.checked },
                    })
                  }
                />
                {l}
              </label>
            ))}
          </div>
          {!connected &&
            ops.events.some((e) => e.kind === "WhatsApp desconectado") && (
              <section className="source-card">
                <h2>WhatsApp desconectado</h2>
                <p>
                  Restaure a conexão da loja para retomar as leituras deste
                  canal.
                </p>
                <Button onClick={onConnect}>
                  Reconectar WhatsApp de exemplo
                </Button>
              </section>
            )}
          <List
            label="Alertas ativos"
            empty="Nenhum alerta para as regras ativas."
          >
            {list.rows.map((s) => (
              <ListItem
                key={s.id}
                title={s.name}
                description={s.title}
                href={"#conversa/" + s.id}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      change({
                        seen: ops.seen.includes(s.id)
                          ? ops.seen.filter((x) => x !== s.id)
                          : [...ops.seen, s.id],
                      })
                    }
                  >
                    {ops.seen.includes(s.id) ? "Visto" : "Marcar visto"}
                  </Button>
                }
              />
            ))}
          </List>
          {alerts.length > 10 && <DirectoryPager list={list} noun="alertas" />}
        </>
      ) : view === "resultados" ? (
        <>
          <SalesPerformance
            ops={ops}
            change={change}
            days={resultDays}
            setDays={days=>{setResultDays(days);list.reset();}}
          />
          <CommercialInsights ops={ops} />
          <h2>Atividade registrada</h2>
          <List
            label="Eventos do período"
            empty="Os registros aparecem quando você agenda um retorno, conclui uma rodada ou confirma um desfecho."
          >
            {list.rows.map((e) => (
              <ListItem
                key={e.id}
                title={kinds[e.kind] || e.kind}
                description={[
                  timestamp(e.at),
                  signals.find((s) => s.id === e.contact)?.name,
                  e.cents ? money(e.cents) : e.detail,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                href={
                  e.threadId
                    ? inboxHref(e.threadId)
                    : e.contact
                      ? "#conversa/" + e.contact
                      : undefined
                }
              />
            ))}
          </List>
          {recent.length > 10 && <DirectoryPager list={list} noun="eventos" />}
        </>
      ) : null}
    </PageColumn>
  );
}
