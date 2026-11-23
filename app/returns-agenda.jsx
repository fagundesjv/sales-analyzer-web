"use client";
import { activeMembers, contactsOf, kindOf } from "../lib/operation";
import { useState } from "react";
import {
  Button,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { ArrowUpRight, CalendarClock, Check, RotateCcw, Sparkles } from "lucide-react";
import { Pills } from "../src/ui/os/pills";
import { channels, inboxHref, localDate, primaryThread, threadsOf } from "../lib/inbox";
import { readingOf } from "../lib/intake";
import { recoveryQueue } from "../lib/recovery-queue";
import styles from "./returns-agenda.module.css";

import { DirectoryPager, useDirectoryPage } from "./directory";
import { ProductVisual } from "./product-visual";
import { ReturnCycle } from "./return-cycle";

export function ReturnsAgenda({ ops, change }) {
  const [tab, setTab] = useState("open");
  const [edit, setEdit] = useState(null);
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const today = localDate();
  const contacts = contactsOf(ops);
  const open = ops.tasks.filter((t) => !t.done);
  const groups = [
    ["open", "Em aberto", open],
    ["today", "Até hoje", open.filter((t) => t.due && t.due <= today)],
    ["done", "Concluídos", ops.tasks.filter((t) => t.done)],
  ];
  const threads = new Map(threadsOf(ops).map(thread => [thread.id, thread]));
  const people = new Map(contacts.map(person => [person.id, person]));
  const queue = recoveryQueue(ops, { includeScheduled: true });
  const priority = new Map(queue.map((row, i) => [row.thread.id, i]));
  function origin(task) {
    const person = people.get(task.contact);
    const thread = threads.get(task.threadId || (person && primaryThread(person)));
    return { person: person || people.get(thread?.contactId), thread };
  }
  const rows = [...groups.find(([id]) => id === tab)[2]].sort((a, b) =>
    (a.due || "9999").localeCompare(b.due || "9999") ||
    (priority.get(origin(a).thread?.id) ?? queue.length) - (priority.get(origin(b).thread?.id) ?? queue.length)
  );
  const list = useDirectoryPage(rows);
  const next = tab !== "done" && rows.find(task => {
    const { person, thread } = origin(task);
    return person && thread;
  });
  const nextOrigin = next && origin(next);
  const canRecover = next && ["risk", "lost"].includes(kindOf(nextOrigin.person, ops));
  const reading = canRecover && readingOf(ops, nextOrigin.person, nextOrigin.thread);
  const suggestion = tab === "open" && !rows.length && queue[0];
  const featuredContact = nextOrigin?.person || suggestion?.contact;
  const featuredThread = nextOrigin?.thread || suggestion?.thread;
  function dayLabel(date) {
    if (!date) return "Sem data";
    if (date === today) return "Hoje";
    if (date === localDate(1)) return "Amanhã";
    return date.split("-").reverse().join("/");
  }
  function update(current, delta, kind, detail) {
    change(
      {
        tasks: ops.tasks.map((t) =>
          t.id === current.id ? { ...t, ...delta } : t,
        ),
      },
      { kind, detail, threadId: current.threadId, contact: current.contact },
    );
  }
  return (
    <>
      <div className={styles.agenda}>
        <div className={styles.toolbar}>
          <Pills label="Retornos exibidos" value={tab} onChange={v=>{setTab(v);list.reset();}}
            items={groups.map(([value, label, tasks]) => ({ value, label, count: tasks.length }))} />
          <ReturnCycle {...{ ops, change }} />
        </div>
        {featuredContact && <section className={styles.brief} aria-label={next ? "Próximo retorno" : "Sugestão da Zoe para a agenda livre"}>
          <div className={styles.briefText}>
            <span className={styles.byline}><Sparkles size={15} aria-hidden="true" /> {next ? "Próximo retorno da Zoe" : "Sugestão da Zoe"}</span>
            <h2>{next ? featuredContact.name : "Agenda livre"}</h2>
            {next ? <>
              <p>{reading ? reading.next : next.text}</p>
              <small>{[channels[featuredThread.channel], next.owner, dayLabel(next.due)].filter(Boolean).join(" · ")}</small>
            </> : <>
              <p>{featuredContact.name} {suggestion.waiting ? "aguarda uma resposta" : "tem uma retomada pendente"} no {channels[featuredThread.channel]}.</p>
              <blockquote>“{suggestion.quote}”</blockquote>
            </>}
          </div>
          {featuredContact.product && <figure className={styles.product}>
            <div><ProductVisual contact={featuredContact} /></div>
            <figcaption>{featuredContact.product}</figcaption>
          </figure>}
          <ButtonLink href={inboxHref(featuredThread.id) + (canRecover ? "/plano" : "")} trailingIcon={ArrowUpRight}>
            {canRecover ? "Revisar retomada" : next ? "Abrir conversa" : "Ver conversa"}
          </ButtonLink>
        </section>}
        {rows.length ? <ul className={styles.list} aria-label="Agenda de retornos">
          {list.rows.map(task => {
            const { person, thread } = origin(task);
            const late = !task.done && task.due && task.due < today;
            return <li key={task.id} className={styles.row}>
              <div className={styles.detail}>
                <small><span className={styles.date} data-late={!!late}>{late && "Atrasado · "}{dayLabel(task.due)}</span>
                  {task.owner && <> · {task.owner}</>}</small>
                {thread ? <a href={inboxHref(thread.id)}>{task.text}<ArrowUpRight size={14} aria-hidden="true" /></a> : <strong>{task.text}</strong>}
                {person && <small>{[person.name, channels[thread?.channel]].filter(Boolean).join(" · ")}</small>}
              </div>
              <div className={styles.actions}>
                {!task.done && <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => {
                  setEdit(task); setDue(task.due || today); setOwner(task.owner || activeMembers(ops)[0]?.name || "");
                }}>Reagendar</Button>}
                <Button size="sm" icon={task.done ? RotateCcw : Check}
                  onClick={() => update(task, {done: !task.done}, task.done ? "Retorno reaberto" : "Retorno concluído", task.text)}>
                  {task.done ? "Reabrir" : "Concluir"}
                </Button>
              </div>
            </li>;
          })}
        </ul> : !suggestion && <div className={styles.empty}>
          <CalendarClock size={22} aria-hidden="true" />
          <h2>{tab === "today" ? "Tudo em dia" : tab === "done" ? "Nenhum retorno concluído" : "Agenda livre"}</h2>
          <p>{tab === "today" ? "Nenhum retorno vencido ou previsto para hoje." : tab === "done" ? "Os retornos que você concluir aparecem aqui." : "Agende um follow-up dentro da conversa para acompanhar a negociação."}</p>
          {tab === "open" && <ButtonLink href="#radar" trailingIcon={ArrowUpRight}>Ver quem precisa de retorno</ButtonLink>}
        </div>}
        {rows.length > 10 && <DirectoryPager list={list} noun="retornos" />}
      </div>
      {edit && (
        <ResponsiveDialog
          footer={
            <Button form="editar-retorno" type="submit" variant="primary">
              {" "}
              Salvar retorno{" "}
            </Button>
          }
          open
          title="Reagendar retorno"
          onClose={() => setEdit(null)}
          size="sm"
        >
          <form
            id="editar-retorno"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!due || !owner) return;
              update(
                edit,
                { due, owner },
                "Retorno reagendado",
                edit.text +
                  " · " +
                  owner +
                  " · " +
                  due.split("-").reverse().join("/"),
              );
              setEdit(null);
            }}
          >
            <p>{edit.text}</p>
            <label className="op-field">
              Nova data
              <input
                required
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label className="op-field">
              Responsável
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {[
                  ...new Set([
                    edit.owner,
                    ...activeMembers(ops).map((m) => m.name),
                  ]),
                ].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </form>
        </ResponsiveDialog>
      )}
    </>
  );
}
