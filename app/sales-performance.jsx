"use client";
import { ReaisField } from "./operation-fields";
import { IconAction } from "../src/ui/os/icon-action";
import { useState } from "react";
import {
  Button,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { Activity, ArrowUpRight, BarChart3, CalendarDays } from "lucide-react";
import {
  contactsOf,
  kindOf,
  money,
  parseMoney,
  totals,
  timestamp,
} from "../lib/operation";
import {
  channels,
  inboxHref,
  localDate,
  primaryThread,
  threadsOf,
} from "../lib/inbox";
import { attendanceProfile } from "../lib/attendance";
import { attendanceDuration } from "../lib/official/analysis";
import st from "./performance.module.css";

export function SalesPerformance({ ops, change, days, setDays }) {
  const contacts = contactsOf(ops);
  const threads = threadsOf(ops);
  const [owner, setOwner] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("");
  const unique = (a) => [...new Set(a)].filter(Boolean);
  const roster = unique([
    ...contacts.map((c) => c.owner),
    ...ops.events.map((e) => e.owner),
  ]);
  const dates = Array.from({ length: days }, (_, i) => localDate(i - days + 1));
  const range = new Set(dates);
  const pool = totals(ops)
    .sales.map((sale) => {
      const contact = contacts.find((c) => c.id === sale.contact);
      const thread = threads.find(
        (t) => t.id === (sale.threadId || (contact && primaryThread(contact))),
      );
      const d = new Date(sale.at);
      const date = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      return {
        ...sale,
        name: contact?.name || "Contato",
        person: sale.owner || contact?.owner,
        thread,
        date,
      };
    })
    .filter(
      (s) => range.has(s.date) && (!channel || s.thread?.channel === channel),
    );
  const sales = pool.filter((s) => !owner || s.person === owner);
  const byDay = dates.map((date) => sales.filter((s) => s.date === date));
  const sum = (rows) => rows.reduce((n, s) => n + s.cents, 0);
  const peak = Math.max(1, ...byDay.map(sum));
  const items = sales.filter((s) => !day || s.date === day);
  const population = contacts.filter(
    (c) =>
      (!owner || c.owner === owner) &&
      threads.some(
        (t) => t.contactId === c.id && (!channel || t.channel === channel),
      ),
  );
  const handled = population.filter((c) =>
    ["resolved", "won", "lost"].includes(ops.outcomes[c.id]?.kind),
  ).length;
  const profile = attendanceProfile(ops, channel, owner, contacts, days);
  function correct(e) {
    e.preventDefault();
    const cents = parseMoney(value);
    if (!cents || cents === selected.cents || !reason.trim()) return;
    const latest = totals(ops).sales.find(
      (s) => s.contact === selected.contact,
    );
    const current = ops.outcomes[selected.contact];
    const delta =
      latest?.id === selected.id && current?.kind === "won"
        ? {
            outcomes: {
              ...ops.outcomes,
              [selected.contact]: { ...current, cents },
            },
          }
        : {};
    change(delta, {
      kind: "Correção de venda",
      saleId: selected.id,
      contact: selected.contact,
      threadId: selected.thread?.id,
      cents,
      detail: reason.trim(),
      owner: selected.person,
    });
    setSelected(null);
  }
  return (
    <section className={st.panel} aria-label="Desempenho comercial">
      <header>
        <div>
          <span className={st.kicker}>
            <Activity size={14} /> Desempenho comercial
          </span>
          <h2>Ritmo de vendas</h2>
        </div>
        <div className={st.inputs}>
          <select
            className="sales-select"
            aria-label="Período da atividade"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setDay("");
            }}
          >
            {[7, 30, 90].map((n) => (
              <option key={n} value={n}>
                {n} dias
              </option>
            ))}
          </select>
          <select
            className="sales-select"
            aria-label="Canal do resultado"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setDay("");
            }}
          >
            <option value="">Todos os canais</option>
            {Object.entries(channels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className={st.layout}>
        <div className={st.chart}>
          <strong>{money(sum(sales))}</strong>
          <span>
            {sales.length}{" "}
            {sales.length === 1 ? "venda confirmada" : "vendas confirmadas"} ·{" "}
            {money(sum(sales.filter((s) => s.recovered)))} recuperados
          </span>
          <div
            className={st.plot}
            style={{ "--days": days }}
            aria-label="Valor confirmado por dia"
          >
            {dates.map((d, i) => (
              <IconAction
                aria-label={
                  d.split("-").reverse().join("/") +
                  " · " +
                  money(sum(byDay[i]))
                }
                aria-pressed={day === d}
                title={
                  d.split("-").reverse().join("/") +
                  " · " +
                  money(sum(byDay[i]))
                }
                key={d}
                onClick={() => setDay(day === d ? "" : d)}
              >
                <i
                  style={{
                    height: Math.max(3, (sum(byDay[i]) / peak) * 100) + "%",
                  }}
                  data-empty={!byDay[i].length}
                />
              </IconAction>
            ))}
          </div>
          <div className={st.axis}>
            <span>{dates[0].slice(5).split("-").reverse().join("/")}</span>
            <span>Hoje</span>
          </div>
        </div>
        <div className={st.team}>
          <h3>Por vendedor</h3>
          <button aria-pressed={!owner} onClick={() => setOwner("")}>
            Toda a equipe<b>{money(sum(pool))}</b>
          </button>
          {roster.map((n) => (
            <button
              key={n}
              aria-pressed={owner === n}
              onClick={() => setOwner(owner === n ? "" : n)}
            >
              {n}
              <b>{money(sum(pool.filter((s) => s.person === n)))}</b>
            </button>
          ))}
          <small>
            {handled} de {population.length} oportunidades com desfecho
            registrado no recorte atual
          </small>
        </div>
      </div>
      <div className={st.list}>
        <h3>
          {day
            ? "Vendas de " + day.split("-").reverse().join("/")
            : "Vendas do período"}
        </h3>
        {day && (
          <Button size="sm" variant="ghost" onClick={() => setDay("")}>
            Ver todo o período
          </Button>
        )}
        {items.map((s) => (
          <button
            className={st.sale}
            key={s.id}
            onClick={() => {
              setSelected(s);
              setValue(String(s.cents / 100).replace(".", ","));
              setReason("");
            }}
          >
            <span>
              <b>{s.name}</b>
              <small>
                {s.person} · {channels[s.thread?.channel] || "Venda registrada"}{" "}
                · {timestamp(s.at)}
              </small>
            </span>
            <strong>{money(s.cents)}</strong>
            <ArrowUpRight size={15} />
          </button>
        ))}
        {!items.length && <p>Nenhuma venda confirmada neste recorte.</p>}
      </div>
      <details className={st.profile}>
        <summary>
          Tempo de resposta <b>{attendanceDuration(profile.elapsed.median)}</b>
        </summary>
        {profile.samples.length ? (
          <>
            <p>
              Mediana de {profile.samples.length} respostas com horário
              registrado. Em 90% dos casos, a equipe respondeu em até{" "}
              {attendanceDuration(profile.elapsed.p90)}. Tempo corrido.
            </p>
            <p>
              {profile.confidence === "ready"
                ? "Referência estabelecida"
                : profile.confidence === "provisional"
                  ? "Referência provisória"
                  : "Amostra inicial"}{" "}
              · {profile.conversations} conversas · {profile.days} dias
              observados
            </p>
            {profile.samples.slice(0, 10).map((s, i) => (
              <a key={i} href={inboxHref(s.conversationId)}>
                {s.name} · {channels[s.channel]}
                <b>{attendanceDuration(s.minutes)}</b>
              </a>
            ))}
          </>
        ) : (
          <p>
            Importe um TXT do WhatsApp com data e hora ou registre uma mensagem
            recebida e sua resposta para medir o intervalo.
          </p>
        )}
      </details>
      {selected && (
        <ResponsiveDialog
          footer={
            <Button
              form="corrigir-venda"
              type="submit"
              variant="primary"
              disabled={
                !reason.trim() ||
                !parseMoney(value) ||
                parseMoney(value) === selected.cents
              }
            >
              {" "}
              Salvar correção{" "}
            </Button>
          }
          open
          title={"Venda de " + selected.name}
          onClose={() => setSelected(null)}
        >
          <form id="corrigir-venda" className="op-form" onSubmit={correct}>
            <p>
              {money(selected.cents)} confirmados em {timestamp(selected.at)}.{" "}
              {selected.person} · {channels[selected.thread?.channel]}
            </p>
            {selected.thread && (
              <ButtonLink href={inboxHref(selected.thread.id)}>
                Ler conversa de origem
              </ButtonLink>
            )}
            <label className="op-field">
              Corrigir valor confirmado
              <ReaisField required aria-label="Corrigir valor confirmado" value={value} onValueChange={setValue} />
            </label>
            <label className="op-field">
              Motivo da correção
              <input
                required
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </form>
        </ResponsiveDialog>
      )}
    </section>
  );
}
