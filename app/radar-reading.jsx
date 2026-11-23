"use client";

import { useState } from "react";
import {
  Button,
  ButtonLink,
  LineChart,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Sparkles,
} from "lucide-react";
import { IconAction } from "../src/ui/os/icon-action";
import { Pills } from "../src/ui/os/pills";
import { channels, inboxHref } from "../lib/inbox";
import { money } from "../lib/operation";
import s from "./radar.module.css";

const palette = [
  "var(--radar-coral)",
  "var(--radar-gold)",
  "var(--radar-lilac)",
  "var(--radar-teal)",
  "var(--subtle)",
];

function riskGroups(contacts) {
  const groups = new Map();
  for (const contact of contacts) {
    const name = contact.category || "Outros sinais";
    const group = groups.get(name) || { name, people: [], cents: 0 };
    group.people.push(contact);
    group.cents += contact.cents || 0;
    groups.set(name, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.cents - a.cents ||
      b.people.length - a.people.length ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

function exposureArc(groups, unit) {
  const amounts = groups.map((g) =>
    unit === "count" ? g.people.length : g.cents,
  );
  const total = amounts.reduce((a, b) => a + b, 0);
  if (!total) return "var(--line-strong)";
  let start = 0;
  const slices = amounts.map((value, i) => {
    const end = start + (180 * value) / total;
    const stop =
      palette[i % palette.length] + " " + start + "deg " + end + "deg";
    start = end;
    return stop;
  });
  return (
    "conic-gradient(from -90deg," + slices.join(",") + ", transparent 180deg)"
  );
}

export function RadarRisk({ model }) {
  const [unit, setUnit] = useState("money");
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const groups = riskGroups(model.risk);
  const group = groups.find((g) => g.name === selected);
  const cents = groups.reduce((sum, g) => sum + g.cents, 0);
  const unpriced = model.risk.filter((c) => c.cents == null).length;
  const quantity = model.risk.length;
  const amount = unit === "money";
  const value = amount
    ? unpriced && unpriced === quantity
      ? "A apurar"
      : money(cents)
    : String(quantity);
  return (
    <section className={s.exposure} aria-label="Carteira em risco">
      <header className={s.cardHead}>
        <h2>
          <CircleDollarSign size={18} />
          Carteira em risco
        </h2>
        <Pills
          size="sm"
          label="Medida dos motivos"
          value={unit}
          onChange={setUnit}
          items={[
            { value: "money", label: "R$" },
            { value: "count", label: "Qtd." },
          ]}
        />
      </header>
      <div className={s.exposureBody}>
        <div
          className={s.instrument}
          aria-label={amount ? "Valor em risco" : "Negociações em risco"}
        >
          <div className={s.arc} aria-hidden="true">
            <div className={s.arcTrack} />
            <div
              className={s.arcBands}
              style={{ background: exposureArc(groups, unit) }}
            />
          </div>
          <div className={s.arcValue}>
            <small>{amount ? "Valor em risco" : "Negociações em risco"}</small>
            <strong data-long={value.length > 9}>{value}</strong>
          </div>
        </div>
        <div className={s.legendIntro}>
          <h3>Motivos de risco</h3>
          {groups.length > 0 && (
            <div className={s.moreCauses}>
              {amount && cents > 0 && (
                <span>
                  {Math.round((groups[0].cents / cents) * 100)}% em{" "}
                  {groups[0].name.toLocaleLowerCase("pt-BR")}
                </span>
              )}
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="radar-causes"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Recolher" : "Ver motivos"}
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
        <div
          id="radar-causes"
          className={s.legend}
          data-expanded={expanded || !groups.length}
        >
          {groups.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setSelected(g.name)}
              aria-label={"Ver conversas · " + g.name}
            >
              <i style={{ background: palette[i % palette.length] }} />
              <span>{g.name}</span>
              <b>
                {amount
                  ? g.people.every((c) => c.cents == null)
                    ? "A apurar"
                    : money(g.cents)
                  : g.people.length}
              </b>
              <ChevronRight size={14} />
            </button>
          ))}
          {!groups.length && <p>Nenhuma negociação em risco neste recorte.</p>}
        </div>
      </div>
      <footer>
        {quantity}{" "}
        {quantity === 1 ? "negociação em risco" : "negociações em risco"}
        {unpriced > 0 && " · " + unpriced + " com valor a apurar"}
      </footer>
      {group && (
        <ResponsiveDialog
          open
          title={group.name}
          size="sm"
          onClose={() => setSelected(null)}
        >
          <div className={s.sources}>
            {group.people.map((person) => (
              <div key={person.id}>
                <div className={s.sourceHeading}>
                  <strong>{person.name}</strong>
                  <b>
                    {person.cents == null ? "A apurar" : money(person.cents)}
                  </b>
                </div>
                <p>{person.title}</p>
                {model.active
                  .filter((t) => t.contactId === person.id)
                  .map((t) => (
                    <a
                      key={t.id}
                      href={inboxHref(t.id)}
                      onClick={() => setSelected(null)}
                    >
                      {channels[t.channel]} · {t.account}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
              </div>
            ))}
          </div>
        </ResponsiveDialog>
      )}
    </section>
  );
}

export function RadarEvolution({ model, ops, owner, period }) {
  const [metric, setMetric] = useState("conversations");
  const isRisk = metric === "risk";
  const reads = ops.runs
    .filter(
      (r) =>
        r.sourceKey === "Caixa de entrada" &&
        (!owner || Array.isArray(r.records)) &&
        (!r.days || Number(r.days) === period) &&
        r.at >= Date.now() - period * 86400000,
    )
    .slice(0, 12)
    .reverse();
  const riskAt = (run) =>
    Array.isArray(run.records)
      ? run.records
          .filter((c) => c.status === "risk" && (!owner || c.owner === owner))
          .reduce((sum, c) => sum + (c.cents || 0), 0)
      : run.riskCents || 0;
  const measure = isRisk
    ? "Valor em risco"
    : metric === "sales"
      ? "Vendas"
      : "Conversas";
  const data = isRisk
    ? reads.map((r) => ({
        label: new Date(r.at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        values: { value: riskAt(r) / 100 },
      }))
    : model.days.map((d) => ({
        label: d.day.slice(8) + "/" + d.day.slice(5, 7),
        values: { value: d[metric] },
      }));
  const summary = isRisk
    ? "Valor por leitura da Zoe"
    : metric === "sales"
      ? "Vendas confirmadas por dia"
      : "Conversas com atividade por dia";
  return (
    <section className={s.evolution} aria-label="Evolução da operação">
      <header className={s.cardHead}>
        <h2>Evolução da operação</h2>
        <small>{period} dias</small>
      </header>
      <Pills
        label="Indicador do Radar"
        size="sm"
        value={metric}
        onChange={setMetric}
        items={[
          { value: "conversations", label: "Conversas" },
          { value: "risk", label: "Em risco" },
          { value: "sales", label: "Vendas" },
        ]}
      />
      <div className={s.trendValue}>
        <strong>
          {isRisk
            ? reads.length
              ? money(riskAt(reads.at(-1)))
              : "—"
            : metric === "sales"
              ? model.sales.length
              : model.active.length}
        </strong>
        <small>
          {isRisk
            ? "na última leitura"
            : metric === "sales"
              ? "vendas no período"
              : "conversas no período"}
        </small>
      </div>
      {data.length > 1 ? (
        <>
          <LineChart
            height={138}
            curve="linear"
            area
            markLast
            min={0}
            label={summary}
            series={[
              { key: "value", label: measure, color: isRisk ? "red" : "teal" },
            ]}
            data={data}
            format={isRisk ? (v) => money(Math.round(v * 100)) : undefined}
          />
          <p className={s.caption}>{summary}</p>
        </>
      ) : reads.length === 1 ? (
        <a className={s.firstRead} href={"#diagnosticos/" + reads[0].id}>
          <span>Primeira leitura · {data[0].label}</span>
          <ArrowUpRight size={16} />
        </a>
      ) : (
        <p className={s.caption}>
          Atualize a leitura para iniciar o histórico de valor em risco.
        </p>
      )}
    </section>
  );
}

export function RadarBrief({ queue, ask, sourceLabel }) {
  const [id, setId] = useState("");
  const [question, setQuestion] = useState("");
  const index = Math.max(
    0,
    queue.findIndex((row) => row.thread.id === id),
  );
  const row = queue[index];
  const shift = (n) =>
    setId(queue[(index + n + queue.length) % queue.length].thread.id);
  const firstName = row?.contact.name.split(" ")[0];
  const title =
    row?.headline ? row.headline : row?.reason === "Cliente quer pagar"
      ? firstName + " quer pagar."
      : row?.waiting && row.reason === "Aguarda resposta"
        ? firstName + " espera uma resposta."
        : row
          ? row.contact.name + " · " + row.reason
          : "Fila em dia";
  function submit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    ask(question.trim());
    setQuestion("");
  }
  return (
    <section className={s.brief} aria-label="Recomendação da Zoe">
      <header className={s.briefHead}>
        <div className={s.zoe}>
          <img src="/assets/idle_thumbnail.png" alt="" />
          <span>{sourceLabel || "Zoe recomenda"}</span>
        </div>
        {queue.length > 1 && (
          <div className={s.pager}>
            <IconAction aria-label="Sinal anterior" onClick={() => shift(-1)}>
              <ChevronLeft size={16} />
            </IconAction>
            <small>
              {index + 1} / {queue.length}
            </small>
            <IconAction aria-label="Próximo sinal" onClick={() => shift(1)}>
              <ChevronRight size={16} />
            </IconAction>
          </div>
        )}
      </header>
      <div className={s.briefBody}>
        <h2>{title}</h2>
        {row ? (
          <>
            <div className={s.meta}>
              {row.thread.channel && <><span>{channels[row.thread.channel]}</span><i /></>}
              {row.waiting && <Clock3 size={12} />}
              {row.waiting ? "Espera de " + row.delay : row.reason}
            </div>
            <blockquote>
              <span aria-hidden="true">“</span>
              <p>{row.quote}</p>
            </blockquote>
            <p className={s.advice}>{row.thread.next || row.contact.next}</p>
            <div className={s.briefActions}>
              <ButtonLink
                variant="primary"
                href={inboxHref(row.thread.id)}
                trailingIcon={ArrowUpRight}
              >
                Abrir conversa
              </ButtonLink>
              {ask && <Button
                variant="ghost"
                icon={Sparkles}
                size="sm"
                onClick={() =>
                  ask(
                    "O que ficou em aberto na conversa de " +
                      row.contact.name +
                      "?",
                    "request",
                    undefined,
                    row.thread,
                  )
                }
              >
                Entender o sinal
              </Button>}
            </div>
          </>
        ) : (
          <p className={s.advice}>
            Nenhum atendimento pendente para este recorte.
          </p>
        )}
      </div>
      {ask && <form className={s.ask} onSubmit={submit}>
        <input
          aria-label="Perguntar à Zoe no Radar"
          placeholder="Pergunte à Zoe…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          enterKeyHint="send"
        />
        <IconAction
          type="submit"
          disabled={!question.trim()}
          aria-label="Enviar pergunta à Zoe"
        >
          <ArrowUp size={16} />
        </IconAction>
      </form>}
    </section>
  );
}
