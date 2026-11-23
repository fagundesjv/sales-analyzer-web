"use client";
import { useEffect, useState } from "react";
import { Button } from "@content-ventures/design-system/v3";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Instagram,
  Mail,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { RadarBrief, RadarEvolution, RadarRisk } from "./radar-reading";
import { commercialBoard } from "../lib/commercial-board";
import { createReading } from "../lib/readings";
import { recoveryQueue } from "../lib/recovery-queue";
import { channels, inboxHref } from "../lib/inbox";
import { contactsOf, kindOf, money } from "../lib/operation";
import styles from "./recovery-desk.module.css";
import s from "./radar.module.css";

export function ContactMark({ s }) {
  return (
    <span aria-hidden="true" className={styles.contactMark} data-tone={s.tone}>
      {s.initials}
    </span>
  );
}

function Queue({ rows, ops }) {
  const [limit, setLimit] = useState(5);
  const shown = rows.slice(0, limit);
  return (
    <section className={s.queue} aria-label="Fila de recuperação">
      <header className={s.cardHead}>
        <h2>Fila de recuperação</h2>
        <small>
          {rows.length} {rows.length === 1 ? "conversa" : "conversas"}
        </small>
      </header>
      {shown.map((row) => {
        const { contact, thread } = row;
        return (
          <a className={s.queueRow} key={thread.id} href={inboxHref(thread.id)}>
            <span className={s.face}>
              <ContactMark s={contact} />
              <span className={s.channel} title={channels[thread.channel]}>
                {thread.channel === "whatsapp" ? (
                  <img src="/assets/whatsapp.svg" alt="" />
                ) : thread.channel === "instagram" ? (
                  <Instagram size={12} />
                ) : (
                  <Mail size={12} />
                )}
              </span>
            </span>
            <span className={s.person}>
              <strong>{contact.name}</strong>
              <small>
                {channels[thread.channel]} · {row.owner}
              </small>
            </span>
            <span className={s.reason} data-urgent={row.priority < 2}>
              {row.reason}
            </span>
            <span className={s.queueValue}>
              <strong
                data-risk={
                  kindOf(contact, ops) === "risk" && contact.cents != null
                }
              >
                {contact.cents == null ? "A apurar" : money(contact.cents)}
              </strong>
              <small>
                <Clock3 size={12} />
                {row.delay}
              </small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        );
      })}
      {!rows.length && (
        <p className={s.caption}>
          Nenhum atendimento pendente para este recorte.
        </p>
      )}
      {rows.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLimit(limit < rows.length ? limit + 10 : 5)}
        >
          {limit >= rows.length ? "Mostrar menos" : "Mostrar mais " + Math.min(10, rows.length - limit) + " conversas"}
        </Button>
      )}
    </section>
  );
}

export function RecoveryDesk({ ops, ask, change }) {
  const [owner, setOwner] = useState("");
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!updated) return;
    const timer = setTimeout(() => setUpdated(false), 1600);
    return () => clearTimeout(timer);
  }, [updated]);
  const period = Math.max(1, Math.min(90, Number(ops.profile.window) || 7));
  const queue = recoveryQueue(ops).filter(
    (row) => !owner || row.owner === owner,
  );
  const model = commercialBoard(ops, { owner, period });
  const owners = [
    ...new Set(
      [
        ...contactsOf(ops).map((c) => c.owner),
        ...ops.tasks.map((t) => t.owner),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const last = ops.runs.find((r) => r.sourceKey === "Caixa de entrada");
  function read() {
    if (updated) return;
    const run = createReading(ops, "Caixa de entrada", period);
    change((before) => ({ runs: [run, ...before.runs] }), {
      kind: "Leitura do Radar",
      detail: run.conversationCount + " conversas",
    });
    setUpdated(true);
  }
  return (
    <div className={s.radar}>
      <header className={s.pageHead}>
        <div>
          <h1>Radar de recuperação</h1>
          <div className={s.reading} aria-live="polite">
            <i data-read={Boolean(last)} />
            {last
              ? "Leitura de " +
                new Date(last.at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Leitura de exemplo"}
            <span>·</span>Últimos {period} dias
          </div>
        </div>
        <div className={s.tools}>
          <label className={s.owner}>
            <UsersRound size={15} />
            <select
              aria-label="Responsável pela fila"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">Toda a equipe</option>
              {owners.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <Button
            size="sm"
            icon={updated ? Check : RefreshCw}
            disabled={updated}
            aria-label={updated ? "Leitura atualizada" : "Atualizar leitura"}
            onClick={read}
          >
            <span>
              {updated ? (
                "Atualizada"
              ) : (
                <>
                  Atualizar<span className={s.readSuffix}> leitura</span>
                </>
              )}
            </span>
          </Button>
        </div>
      </header>
      <div className={s.board}>
        <RadarRisk model={model} key={"risco-" + owner} />
        <RadarBrief queue={queue} ask={ask} key={"zoe-" + owner} />
        <Queue rows={queue} ops={ops} key={"fila-" + owner} />
        <RadarEvolution model={model} ops={ops} owner={owner} period={period} />
      </div>
    </div>
  );
}
