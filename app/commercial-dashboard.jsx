"use client";
import { IconAction } from "../src/ui/os/icon-action";
import { useState } from "react";
import {
  Button,
  ButtonLink,
  ChartCard,
  ChartState,
  MeterList,
  SankeyChart,
  LineChart,
  FunnelChart,
  Segmented,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Mail,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { channels, historyOf, inboxHref, primaryThread } from "../lib/inbox";
import { contactsOf, kindOf, kinds, money } from "../lib/operation";
import { recoveryQueue } from "../lib/recovery-queue";
import { Story } from "../src/ui/os/news-front";
import { Pills } from "../src/ui/os/pills";
import { ProductVisual } from "./product-visual";
import { readSignal } from "../lib/intake";
import { commercialBoard } from "../lib/commercial-board";
import b from "./operations-board.module.css";
import s from "./commercial-dashboard.module.css";

const tones = {
  whatsapp: "teal",
  instagram: "violet",
  email: "sky",
  risk: "amber",
  lost: "red",
  won: "green",
  resolved: "gray",
};
const icons = { whatsapp: MessageCircle, instagram: Instagram, email: Mail };

function ChannelFlow({ rows, channel }) {
  const nodes = new Map();
  const edges = new Map();
  for (const { thread, status } of rows) {
    const source = thread.channel;
    nodes.set(source, {
      key: source,
      label: channels[source],
      column: 0,
      color: tones[source],
    });
    nodes.set(status, {
      key: status,
      label: kinds[status],
      column: 1,
      color: tones[status],
    });
    const key = source + "/" + status;
    edges.set(key, {
      source,
      target: status,
      value: (edges.get(key)?.value || 0) + 1,
    });
  }
  return (
    <ChartCard
      title="Fluxo das conversas"
      titleAs="h2"
      description="Do canal de origem à situação da negociação."
      footer={
        <a href={inboxHref(null, channel)}>
          Abrir conversas deste recorte <ArrowRight size={14} />
        </a>
      }
    >
      {rows.length ? (
        <SankeyChart
          label="Conversas por canal e situação"
          nodes={[...nodes.values()]}
          links={[...edges.values()]}
          height={202}
          format={(n) => n + " " + (n === 1 ? "conversa" : "conversas")}
        />
      ) : (
        <ChartState
          kind="empty"
          title="Nenhuma conversa neste canal"
          height={202}
        />
      )}
    </ChartCard>
  );
}

function RecoveryStory({ queue, ask }) {
  const [threadId, setThreadId] = useState("");
  const index = Math.max(
    0,
    queue.findIndex((row) => row.thread.id === threadId),
  );
  const row = queue[index];
  if (!row)
    return (
      <section className={s.quiet}>
        <h2>Fila em dia</h2>
        <p>Os retornos agendados continuam na agenda da equipe.</p>
        <ButtonLink href="#tarefas">Ver agenda</ButtonLink>
      </section>
    );
  const { contact, thread } = row;
  const Icon = icons[thread.channel];
  const given = contact.name.split(" ")[0];
  const headline =
    row.reason === "Cliente quer pagar"
      ? given + " pediu para pagar"
      : row.reason === "Confirmar pagamento"
        ? "Conferir o pagamento de " + given
        : row.waiting
          ? given + " aguarda uma resposta"
          : "Retomar com " + given;
  const step = (offset) =>
    setThreadId(
      queue[(index + offset + queue.length) % queue.length].thread.id,
    );
  return (
    <section className={s.story} aria-label="Oportunidade em destaque">
      <div className={s.sectionHead}>
        <h2>
          <Sparkles size={16} /> Na fila da Zoe
        </h2>
        <div className={s.pager}>
          <IconAction
            type="button"
            aria-label="Oportunidade anterior"
            disabled={queue.length < 2}
            onClick={() => step(-1)}
          >
            <ChevronLeft size={15} />
          </IconAction>
          <small>
            {index + 1} / {queue.length}
          </small>
          <IconAction
            type="button"
            aria-label="Próxima oportunidade"
            disabled={queue.length < 2}
            onClick={() => step(1)}
          >
            <ChevronRight size={15} />
          </IconAction>
        </div>
      </div>
      <Story
        variant="lead"
        cover={
          <div className={s.cover}>
            <ProductVisual contact={contact} />
            <span>{contact.product}</span>
          </div>
        }
        kicker={
          <>
            <Icon size={13} />
            {channels[thread.channel]} · {row.delay} · {row.owner}
          </>
        }
        title={headline}
        dek={"“" + row.quote + "”"}
        onOpen={() => {
          window.location.hash = inboxHref(thread.id);
        }}
        actions={
          <div className={s.actions}>
            <ButtonLink
              size="sm"
              href={inboxHref(thread.id)}
              variant="primary"
              trailingIcon={ArrowUpRight}
            >
              Retomar conversa
            </ButtonLink>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                ask(
                  "O que " +
                    contact.name +
                    " pediu no " +
                    channels[thread.channel] +
                    "?",
                  "request",
                  undefined,
                  thread,
                )
              }
            >
              Ver com a Zoe
            </Button>
          </div>
        }
      />
    </section>
  );
}

const periods = [7, 30, 90];
const paceOptions = [
  { value: "conversations", label: "Conversas" },
  { value: "replies", label: "Respostas" },
  { value: "sales", label: "Vendas" },
];
export function DashboardVersion({integrated = false}) {
  return (
    <div className={s.version}>
          <span>Versão do painel</span>
          <Segmented
            label="Versão do painel"
            options={[{ value: "v1", label: "V1" }, { value: "v2", label: integrated ? "V2" : "V2 · Prévia" }]}
            value="v2"
            onChange={(version) => {
              if (version === "v1") window.location.assign(process.env.NEXT_PUBLIC_PORTAL_V1_URL || "https://www.salesanalyzer.app/");
            }}
          />
        </div>
  );
}

export function CommercialDashboard({ ops, ask }) {
  const [channel, setChannel] = useState("todos"),
    [period, setPeriod] = useState(7),
    [owner, setOwner] = useState("");
  const [pace, setPace] = useState("conversations"),
    [measure, setMeasure] = useState("valor"),
    [evidence, setEvidence] = useState(null);
  const model = commercialBoard(ops, { channel, period, owner });
  const inScope = new Set(model.active.map((t) => t.id));
  const queue = recoveryQueue(ops, { includeScheduled: true }).filter((r) =>
    inScope.has(r.thread.id),
  );
  const waiting = queue.filter((r) => r.waiting),
    hot = waiting.filter(
      (r) => r.priority === 1 || /pagamento|pagar/i.test(r.reason),
    );
  const late = queue.filter(
    (r) => r.reason === "Retorno atrasado" || r.reason === "Retorno de hoje",
  );
  const riskIds = new Set(model.risk.map((c) => c.id));
  const totalRisk = model.risk.reduce((v, c) => v + (c.cents || 0), 0);
  const lost = model.contacts.filter((c) => kindOf(c, ops) === "lost");
  const recovered = model.sales.filter((e) => e.recovered);
  const quoted = model.active.filter((t) =>
    historyOf(ops, t).some((m) => /R\$\s*\d/i.test(m.text || "")),
  );
  const interest = model.active.filter((t) =>
    historyOf(ops, t).some(
      (m) =>
        !m.outgoing &&
        (readSignal(m.text || "") !== "outro" ||
          /quero|gostaria|interess[ae]|comprar/i.test(m.text || "")),
    ),
  );
  const priced = quoted.filter((t) => interest.includes(t));
  const wonIds = new Set(
    model.sales.map(
      (e) => e.threadId || primaryThread(model.people.get(e.contact)),
    ),
  );
  const stages = [
    ["Conversas", model.active],
    ["Com interesse", interest],
    ["Com cotação", priced],
    ["Venda confirmada", priced.filter((t) => wonIds.has(t.id))],
  ];
  const portfolio = [
    ["Em risco", model.risk, "amber"],
    ["Perdidas", lost, "red"],
    ["Recuperadas", recovered, "green"],
  ].map(([label, rows, color]) => ({
    key: label,
    label,
    color,
    value:
      measure === "valor"
        ? rows.reduce((v, r) => v + (r.cents || 0), 0)
        : rows.length,
  }));
  const peak = Math.max(1, ...portfolio.map((r) => r.value));
  function openFunnel(stage = 0) {
    setEvidence({ title: "Conversas do funil", stage, rows: stages[stage][1] });
  }
  const show = (title, rows) => setEvidence({ title, rows });
  const rankings = (key) => {
    const map = new Map();
    for (const t of model.active) {
      const person = model.people.get(t.contactId),
        name = person[key] || "A identificar";
      map.set(name, [...(map.get(name) || []), t]);
    }
    return [...map].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"),
    );
  };
  const nextSteps = [
    ["Aguardam resposta", waiting],
    ["Com intenção de pagamento", hot],
    ["Follow-up previsto ou vencido", late],
  ];
  const currentMeasure = paceOptions.find((o) => o.value === pace);
  return (
    <div className={s.dashboard}>
      <header className={b.sectionHead}>
        <div>
          <h1 className={b.pageTitle}>Panorama comercial</h1>
          <small className={b.quiet}>{ops.profile.name}</small>
        </div>
        <DashboardVersion />
      </header>
      <div className={s.filters}>
        <Pills
          label="Canal do dashboard"
          size="sm"
          value={channel}
          onChange={setChannel}
          items={[
            { value: "todos", label: "Todos", ariaLabel: "Todos os canais" },
            ...Object.entries(channels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <div className={s.filterFields}>
          <select
            className="sales-select"
            aria-label="Período do dashboard"
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
          >
            {periods.map((v) => (
              <option key={v} value={v}>
                Últimos {v} dias
              </option>
            ))}
          </select>
          <select
            className="sales-select"
            aria-label="Vendedor do dashboard"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="">Toda a equipe</option>
            {[...new Set(contactsOf(ops).map((c) => c.owner))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={b.dashGrid}>
        <section className={b.riskHero}>
          <header>
            <span className={b.byline}>
              <img src="/assets/idle_thumbnail.png" alt="" />
              Leitura da Zoe
            </span>
          </header>
          <span>Valor em risco</span>
          <strong>{money(totalRisk)}</strong>
          <p>
            {model.risk.length}{" "}
            {model.risk.length === 1
              ? "negociação em risco"
              : "negociações em risco"}{" "}
            · {waiting.length}{" "}
            {waiting.length === 1 ? "conversa aguarda" : "conversas aguardam"}{" "}
            resposta
          </p>
          <Button
            size="sm"
            variant="primary"
            trailingIcon={ArrowUpRight}
            onClick={() =>
              show(
                "Negociações em risco",
                model.active.filter((t) => riskIds.has(t.contactId)),
              )
            }
          >
            Ver conversas em risco
          </Button>
        </section>
        <section className={b.panel}>
          <header>
            <h2>Ritmo comercial</h2>
            <Pills
              value={pace}
              size="sm"
              onChange={setPace}
              label="Indicador de ritmo"
              items={paceOptions}
            />
          </header>
          <LineChart
            label={currentMeasure.label + " por dia"}
            height={150}
            data={model.days.map((d) => ({
              label: d.day.slice(8) + "/" + d.day.slice(5, 7),
              values: { v: d[pace] },
            }))}
            series={[{ key: "v", label: currentMeasure.label, color: "teal" }]}
          />
        </section>
        <section className={b.panel}>
          <header>
            <h2>Do interesse à venda</h2>
            <Button size="sm" variant="ghost" onClick={() => openFunnel()}>
              Explorar funil
            </Button>
          </header>
          <div className={b.funnel}>
            <FunnelChart
              label="Etapas comerciais nas conversas"
              stages={stages.map(([label, items]) => ({
                key: label,
                label,
                value: items.length,
              }))}
              height={116}
            />
          </div>
        </section>
        <section className={b.panel}>
          <header>
            <h2>Para agir agora</h2>
            <a href="#radar">Ver Radar ↗</a>
          </header>
          <div className={b.actionRows}>
            {nextSteps.map(([label, rows]) => (
              <button
                key={label}
                onClick={() =>
                  show(
                    label,
                    rows.map((r) => r.thread),
                  )
                }
              >
                <span>{label}</span>
                <b>{rows.length}</b>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className={b.kpis}>
        {[
          ["Conversas", model.active.length],
          ["Vendas confirmadas", model.sales.length],
          ["Valor ganho", money(model.sales.reduce((v, e) => v + e.cents, 0))],
          [
            "Valor recuperado",
            money(recovered.reduce((v, e) => v + e.cents, 0)),
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className={b.dashGrid}>
        {[
          ["Por vendedor", "owner"],
          ["Produtos e serviços", "product"],
        ].map(([title, key]) => (
          <section className={b.panel} key={key}>
            <header>
              <h2>{title}</h2>
              <small>Conversas</small>
            </header>
            <div className={b.actionRows}>
              {rankings(key)
                .slice(0, 5)
                .map(([name, rows]) => (
                  <button key={name} onClick={() => show(name, rows)}>
                    <span>{name}</span>
                    <b>{rows.length}</b>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              {!model.active.length && <p>Nenhuma conversa neste recorte.</p>}
            </div>
          </section>
        ))}
      </div>
      <div className={b.dashGrid}>
        <RecoveryStory key={channel + owner + period} queue={queue} ask={ask} />
        <ChartCard
          title="Carteira de recuperação"
          titleAs="h2"
          actions={
            <Pills
              label="Medida da carteira"
              size="sm"
              value={measure}
              onChange={setMeasure}
              items={[
                { value: "valor", label: "Valor" },
                { value: "volume", label: "Negociações" },
              ]}
            />
          }
        >
          <MeterList
            label="Comparação entre risco, perdas e recuperação"
            format={measure === "valor" ? money : String}
            shares={false}
            items={portfolio.map((i) => ({
              ...i,
              share: (i.value / peak) * 100,
            }))}
          />
          <div className={s.footer}>
            <a href="#crm">
              Abrir pipeline <ArrowRight size={14} />
            </a>
          </div>
        </ChartCard>
      </div>
      <details className="fold">
        <summary>Fluxo por canal e situação</summary>
        <ChannelFlow
          channel={channel}
          rows={model.active.map((thread) => ({
            thread,
            status: kindOf(model.people.get(thread.contactId), ops),
          }))}
        />
      </details>
      {evidence && (
        <ResponsiveDialog
          open
          size="sm"
          title={evidence.title}
          onClose={() => setEvidence(null)}
        >
          {evidence.stage !== undefined && (
            <label className="op-field">
              Etapa do funil
              <select
                aria-label="Etapa do funil"
                value={evidence.stage}
                onChange={(e) => openFunnel(Number(e.target.value))}
              >
                {stages.map(([label, rows], i) => (
                  <option key={label} value={i}>
                    {label} · {rows.length}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={b.evidence}>
            {evidence.rows.map((t) => (
              <a
                href={inboxHref(t.id)}
                key={t.id}
                onClick={() => setEvidence(null)}
              >
                <span>
                  <strong>{model.people.get(t.contactId).name}</strong>
                  <small>
                    {channels[t.channel]} · {t.account}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </a>
            ))}
            {!evidence.rows.length && <p>Nenhuma conversa neste recorte.</p>}
          </div>
        </ResponsiveDialog>
      )}
    </div>
  );
}
