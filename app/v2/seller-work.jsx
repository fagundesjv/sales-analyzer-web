"use client";
import {useEffect, useState} from "react";
import {Button} from "@content-ventures/design-system/v3";
import {CalendarClock, Check, Pause, Play, Square} from "lucide-react";
import {IconAction} from "../../src/ui/os/icon-action";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {DetailPage} from "../../src/ui/os/detail";
import {Pills} from "../../src/ui/os/pills";
import {inboxHref,localDate} from "../../lib/inbox";
import {useV2Action,useV2Page} from "../../lib/v2-client";
import {CursorNav,ReadState} from "./read-state";
import css from "../customer-inbox.module.css";
import f from "../focus.module.css";
import a from "../returns-agenda.module.css";

function TimeActive({round}) {
  const [extra,setExtra] = useState(0);
  useEffect(() => {
    setExtra(0);
    if (round.status !== "running") return;
    const begin = Date.now();
    const timer = setInterval(() => setExtra(Date.now() - begin),1000);
    return () => clearInterval(timer);
  }, [round]);
  const seconds = Math.floor((round.activeMs + extra) / 1000);
  return <b className={f.timer} role="timer" aria-label="Tempo em foco">
    {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}
  </b>;
}

export function FocusBar({read, action, candidate, currentId, onOpen}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [receipt, setReceipt] = useState(null);
  return <div className={css.queueFocusSlot}><ReadState read={read}>{({round}) => {
    const active = round && round.status !== "finished";
    const change = (command, conversationId) => action.run("focus/" + round.id,"PATCH",{
      action:command,version:round.version,...(conversationId ? {conversationId} : {}),
    }, result => {
      if (command === "finish") {setConfirmEnd(false);setReceipt(result);}
      read.retry();
    });
    return <>{active ? <section className={f.inlineBar} aria-label="Rodada de foco">
      <div className={f.roundTitle}><span className={f.roundDial}><img src="/assets/idle_thumbnail.png" width="22" height="22" alt="" /></span>
        <span><strong>Foco da Zoe</strong><small>{round.status === "paused" ? "Pausado" : "Em andamento"}</small></span>
      </div><TimeActive round={round} /><div className={f.roundTools}>
        <IconAction aria-label={round.status === "paused" ? "Retomar rodada" : "Pausar rodada"} disabled={action.pending}
          onClick={() => change(round.status === "paused" ? "resume" : "pause")}>{round.status === "paused" ? <Play size={15} /> : <Pause size={15} />}</IconAction>
        <IconAction aria-label="Encerrar rodada" disabled={action.pending} onClick={() => setConfirmEnd(true)}><Square size={14} /></IconAction>
      </div></section> : <button type="button" disabled={!candidate || action.pending} className={css.startFocus} onClick={() => {
        action.run("focus","POST",{conversationId:candidate}, value => {setReceipt(null); read.retry(); onOpen(value.conversationId);});
      }} aria-label="Iniciar Foco da Zoe">
        <span className={css.zoeMark}><img src="/assets/idle_thumbnail.png" width="34" height="34" alt="" /></span>
        <span className={css.startCopy}><strong>Foco da Zoe</strong><small>{candidate ? "Rodada de atendimento" : "Abra uma conversa para começar"}</small></span>
        <span className={css.startPlay}><Play size={12} /> Iniciar</span>
      </button>}
      {active && currentId && currentId !== round.conversationId && round.status === "running" &&
        <Button size="sm" variant="ghost" onClick={() => change("open",currentId)} disabled={action.pending}>Incluir conversa na rodada</Button>}
      {active && !currentId && round.conversationId && <a href={inboxHref(round.conversationId)}>Voltar à conversa em foco</a>}
      {receipt && !active && <p role="status">Rodada encerrada · {receipt.openedCount} conversa(s) aberta(s).</p>}
      {action.error && <p role="alert">{action.error} <button type="button" onClick={read.retry}>Atualizar rodada</button></p>}
      <ResponsiveDialog open={confirmEnd && !!active} size="sm" title="Encerrar a rodada?" onClose={() => setConfirmEnd(false)}>
        <div className="flow"><p>O tempo em foco e as conversas abertas ficam registrados nesta rodada.</p>
          <Button disabled={action.pending} onClick={() => change("finish")}>Confirmar encerramento</Button></div>
      </ResponsiveDialog></>;
  }}</ReadState></div>;
}

export function ScheduleReturn({item,context,close}) {
  const [title,setTitle] = useState("");
  const [dueDate,setDate] = useState(localDate());
  const action = useV2Action(context);
  return <ResponsiveDialog open title="Agendar retorno" description={item.title} size="sm" onClose={() => {if (!action.pending) close();}}>
    <form className="op-form" onSubmit={e => {e.preventDefault();if (title.trim() && dueDate)
      action.run("returns","POST",{title:title.trim(),dueDate,conversationId:item.id},() => close(true));}}>
      <label className="op-field">Próxima ação<input maxLength={240} required value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="op-field">Data do retorno<input type="date" required value={dueDate} onChange={e => setDate(e.target.value)} /></label>
      {action.error && <p role="alert">{action.error}</p>}
      <Button type="submit" disabled={!title.trim() || !dueDate || action.pending}>Agendar</Button>
    </form></ResponsiveDialog>;
}

function ReturnRow({task,context,refresh}) {
  const [edit,setEdit] = useState(false);
  const [date,setDate] = useState(task.dueDate);
  const action = useV2Action(context);
  const open = task.status === "open";
  const update = delta => action.run("returns/" + task.id,"PATCH",{version:task.version,...delta},() => {setEdit(false);refresh();});
  return <li className={a.row}><div className={a.detail}>
    <small className={a.date} data-late={open && task.dueDate < localDate()}>{task.dueDate.split("-").reverse().join("/")}</small>
    <a href={inboxHref(task.conversationId)}>{task.title}</a><small>{task.conversationTitle}</small></div>
    <div className={a.actions}>{open && <Button variant="ghost" size="sm" icon={CalendarClock}
      onClick={() => {setDate(task.dueDate);setEdit(true);}}>Reagendar</Button>}
      <Button size="sm" icon={Check} disabled={action.pending} onClick={() => update({status:open ? "completed" : "open"})}>
        {open ? "Concluir" : "Reabrir"}</Button>
    </div>{action.error && <p role="alert">{action.error} <button type="button" onClick={refresh}>Reler retorno</button></p>}
    <ResponsiveDialog open={edit} title="Reagendar retorno" size="sm" onClose={() => setEdit(false)}>
      <form className="op-form" onSubmit={e => {e.preventDefault();update({dueDate:date});}}>
        <label className="op-field">Nova data<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        {action.error && <p role="alert">{action.error}</p>}
        <Button type="submit" disabled={!date || action.pending}>Salvar data</Button></form></ResponsiveDialog>
  </li>;
}
export function ConnectedReturns({context}) {
  const [view,setView] = useState("open");
  const page = useV2Page("returns?status=" + (view === "done" ? "completed" : "open") + (view === "today" ? "&throughDate=" + localDate() : ""),context);
  return <DetailPage title="Retornos" icon={CalendarClock} description="Acompanhe a próxima ação combinada em cada conversa.">
    <div className={a.agenda}><div className={a.toolbar}><Pills label="Agenda de retornos" value={view} onChange={setView}
      items={[{value:"open",label:"Em aberto"},{value:"today",label:"Até hoje"},{value:"done",label:"Concluídos"}]} /></div>
      <ReadState read={page}>{({items}) => items.length ? <ul className={a.list} aria-label="Retornos agendados">
        {items.map(task => <ReturnRow key={task.id} task={task} context={context} refresh={page.retry} />)}</ul> :
        <div className={a.empty}><h2>{view === "done" ? "Nenhum retorno concluído" : "Agenda livre"}</h2><a href="#entrada">Abrir conversas</a></div>}</ReadState>
      <CursorNav page={page} label="Páginas de retornos" /></div>
  </DetailPage>;
}
