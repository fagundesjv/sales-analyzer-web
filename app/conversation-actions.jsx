"use client";
import { IconAction } from "../src/ui/os/icon-action";
import {
  Button,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  CheckCheck,
  CircleDollarSign,
  Crosshair,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { nextFocusHref } from "../lib/recovery-queue";
import {
  followUps,
  isResolved,
  opportunityValue,
} from "../lib/conversation-work";
import { channels, localDate } from "../lib/inbox";
import { kinds, kindOf, money, totals } from "../lib/operation";
import { CaseActions } from "./operations";
import css from "./customer-inbox.module.css";

const dateLabel = (date) =>
  date === localDate()
    ? "hoje"
    : date === localDate(1)
      ? "amanhã"
      : date?.split("-").reverse().join("/");
export function OpportunityBadge({ ops, contact, onClick }) {
  const kind = kindOf(contact, ops);
  const amount = opportunityValue(ops, contact);
  const amountText = amount == null ? "A apurar" : money(amount);
  return (
    <button
      type="button"
      className={css.statusAmount}
      data-kind={kind}
      onClick={onClick}
      aria-label={
        kinds[kind] + " · " + amountText + " · Ver valor da oportunidade"
      }
    >
      <span>
        <i />
        {kinds[kind]}
      </span>
      <b>{amountText}</b>
    </button>
  );
}
export function ConversationActions({
  thread,
  contact,
  ops,
  change,
  notify,
  fromFocus,
  onFocus,
  mode,
  setMode,
}) {
  const tasks = followUps(ops, thread, contact);
  const closed = isResolved(ops, thread, tasks);
  const kind = kindOf(contact, ops);
  const amount = opportunityValue(ops, contact);
  const amountText = amount == null ? "A apurar" : money(amount);
  const share =
    kind === "risk" && amount > 0
      ? Math.round((100 * amount) / totals(ops).risk)
      : 0;
  function finish() {
    const atFocus = fromFocus && ops.focus && !ops.focus.paused;
    change(
      (before) =>
        atFocus
          ? {
              focus: {
                ...before.focus,
                handled: closed
                  ? (before.focus.handled || []).filter((k) => k !== thread.id)
                  : [...new Set([...(before.focus.handled || []), thread.id])],
              },
            }
          : {},
      {
        kind: closed ? "Atendimento reaberto" : "Atendimento resolvido",
        contact: contact.id,
        threadId: thread.id,
        author: contact.owner,
        detail: channels[thread.channel] + " · " + contact.name,
      },
    );
    setMode("");
    notify(closed ? "Conversa reaberta." : "Conversa resolvida.");
    if (atFocus && !closed) location.hash = nextFocusHref(ops, thread.id);
  }
  return (
    <>
        <div
          className={css.tradeTools}
          role="group"
          aria-label="Ações comerciais"
        >
          <IconAction
            type="button"
            onClick={() => setMode(tasks.length ? "follow" : "task")}
            aria-label={
              tasks.length ? "Follow-up " + tasks.length : "Follow-up"
            }
            title="Consultar ou agendar follow-up"
          >
            <CalendarClock size={15} />
            <span>Follow-up</span>
            {tasks.length > 0 && <small>{tasks.length}</small>}
          </IconAction>
          {!ops.focus && (
            <IconAction
              type="button"
              className={css.mobileFocusStart}
              onClick={onFocus}
              title="Foco da Zoe"
              aria-label="Foco da Zoe"
            >
              <Crosshair size={15} />
              <span>Foco da Zoe</span>
            </IconAction>
          )}
          <button type="button" className={css.resolveButton} data-closed={closed}
            aria-haspopup="dialog" onClick={() => setMode("decision")}>
            <CheckCheck size={15} /> Desfecho <ChevronDown size={12} />
          </button>
        </div>
      {mode === "decision" && (
        <ResponsiveDialog open size="sm" title={"Desfecho · " + contact.name} onClose={() => setMode("")}>
          <div className={css.outcomeChoices}>
            <h3>Atendimento · {channels[thread.channel]}</h3>
            <button type="button" onClick={finish}>
              {closed ? <RotateCcw /> : <CheckCheck />}
              <span><strong>{closed ? "Reabrir conversa" : "Resolver conversa"}</strong>
                <small>{closed ? "Devolver esta conversa à fila de atendimento." : "Concluir a pendência deste canal e manter a venda como está."}</small></span>
              <ChevronRight />
            </button>
            <h3>Venda · {kinds[kind]}</h3>
            {kind !== "won" && <button type="button" onClick={() => setMode("won")}>
              <Trophy data-tone="won" /><span><strong>Marcar como ganha</strong><small>Confirmar o valor fechado com o cliente.</small></span><ChevronRight />
            </button>}
            {kind !== "lost" && <button type="button" onClick={() => setMode("lost")}>
              <CircleMinus data-tone="lost" /><span><strong>Marcar como perdida</strong><small>Registrar por que a venda caiu.</small></span><ChevronRight />
            </button>}
            {kind !== "risk" && <button type="button" onClick={() => setMode("risk")}>
              <RotateCcw /><span><strong>Reabrir negociação</strong><small>Voltar a acompanhar esta oportunidade em risco.</small></span><ChevronRight />
            </button>}
          </div>
        </ResponsiveDialog>
      )}
      {mode === "value" && (
        <ResponsiveDialog
          open
          size="sm"
          title="Valor da oportunidade"
          onClose={() => setMode("")}
        >
          <div className="op-form">
            <div className={css.valueSheet}>
              <CircleDollarSign size={20} />
              <small>
                {kind === "risk"
                  ? "Valor em risco"
                  : kind === "won"
                    ? "Venda confirmada"
                    : "Valor citado"}
              </small>
              <strong>{amountText}</strong>
              <span>
                {contact.product} · {contact.name}
              </span>
              {share > 0 && (
                <>
                  <progress
                    value={amount}
                    max={totals(ops).risk}
                    aria-label="Parcela do valor em risco"
                  />
                  <small>{share}% do valor em risco da operação</small>
                </>
              )}
            </div>
            <div className="actions">
              <ButtonLink
                href={"#conversa/" + contact.id + "/" + thread.id}
                trailingIcon={ArrowUpRight}
              >
                Ver oportunidade
              </ButtonLink>

            </div>
          </div>
        </ResponsiveDialog>
      )}
      {mode === "follow" && (
        <ResponsiveDialog
          open
          size="sm"
          title={"Follow-ups de " + contact.name.split(" ")[0]}
          onClose={() => setMode("")}
        >
          <div className="op-form">
            <ul className={css.followList}>
              {tasks.map((t) => (
                <li key={t.id}>
                  <CalendarClock size={16} />
                  <span>
                    <strong>{t.text}</strong>
                    <small>
                      {t.owner} · {dateLabel(t.due)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            <div className="actions">
              <ButtonLink href="#tarefas">Abrir agenda</ButtonLink>
              <Button variant="primary" onClick={() => setMode("task")}>
                Agendar outro retorno
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      )}
      {["task", "won", "lost", "risk"].includes(mode) && (
        <CaseActions
          key={mode}
          initialAction={mode === "task" ? "task" : "outcome"}
          status={mode}
          onDismiss={() => setMode("")}
          afterResult={
            fromFocus && mode !== "risk"
              ? () => {
                  location.hash = nextFocusHref(ops, thread.id, contact.id);
                }
              : undefined
          }
          s={contact}
          threadId={thread.id}
          {...{ ops, change, notify }}
        />
      )}
    </>
  );
}
