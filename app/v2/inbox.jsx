"use client";
import {useEffect, useRef, useState} from "react";
import {Button, SearchField} from "@content-ventures/design-system/v3";
import {ArrowLeft, CalendarClock, Star, CheckCheck, ChevronRight, CircleMinus, Trophy} from "lucide-react";
import {IconAction} from "../../src/ui/os/icon-action";
import {FocusBar, ScheduleReturn} from "./seller-work";
import {Pills} from "../../src/ui/os/pills";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {inboxHref} from "../../lib/inbox";
import {money, parseMoney} from "../../lib/operation";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import {ReaisField} from "../operation-fields";
import {OutcomeCelebration} from "../outcome-celebration";
import {ContactMark} from "../recovery-desk";
import {initials, outcomes} from "./work-queue";
import {CursorNav, ReadState} from "./read-state";
import {AttendanceComposer, conversationMessages, receiptLabel} from "./attendance";
import css from "../customer-inbox.module.css";

const choices = [
  {status:"won",label:"Venda ganha",icon:Trophy},
  {status:"lost",label:"Venda perdida",icon:CircleMinus},
  {status:"resolved",label:"Resolver conversa",icon:CheckCheck},
];
function OutcomeDialog({item, context, confirming, close, saved, reload}) {
  const [status, setStatus] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const action = useV2Action(context);
  const cents = parseMoney(amount);
  const ready = confirming || (status === "won" ? cents !== null : status === "lost" ? !!reason.trim() : status === "resolved");
  const choice = choices.find(x => x.status === status);
  const title = confirming ? "Confirmar ganho" : choice?.label || "Desfecho da conversa";
  return <ResponsiveDialog open onClose={() => {if (!action.pending) close();}} dismissible={!action.pending}
    size="sm" title={title} description={item.title}>
    {!choice && !confirming ? <div className={css.outcomeChoices}>{choices.map(({status,label,icon:Icon}) =>
      <button key={status} onClick={() => setStatus(status)} data-tone={status}><Icon aria-hidden="true" />
        <strong>{label}</strong><ChevronRight aria-hidden="true" /></button>)}</div> :
      <form className="flow" onSubmit={e => {e.preventDefault(); if (!ready) return;
        const data = confirming ? {recordedAt:item.outcome.recordedAt} : status === "won" ? {status,amountCents:cents} :
          status === "lost" ? {status,lossReason:reason.trim()} : {status};
        action.run("conversations/" + item.id + "/outcome" + (confirming ? "/confirmation" : ""), "PUT", data, saved);
      }}>
        {confirming ? <p>Confirmar a venda de <strong>{money(item.outcome.amountCents)}</strong> registrada nesta conversa?</p> :
          status === "won" ? <label>Valor da venda <ReaisField required aria-label="Valor da venda" value={amount} onValueChange={setAmount} /></label> :
          status === "lost" ? <label>Motivo da perda <textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label> :
          <p>Registrar esta conversa como resolvida?</p>}
        {action.error && <div role="alert"><p>{action.error}</p>
          <Button variant="ghost" size="sm" type="button" onClick={reload}>Reler conversa</Button></div>}
        <Button type="submit" disabled={!ready || action.pending}>{action.pending ? "Salvando…" :
          confirming ? "Confirmar ganho" : status === "resolved" ? "Resolver" : "Registrar desfecho"}</Button>
      </form>}
  </ResponsiveDialog>;
}
function Thread({item, context, session, refresh, focus, evidence}) {
  const cited = useRef(null);
  const log = useRef(null);
  const path = "conversations/"+item.id+"/attendance";
  const attendance = useV2Read(path,context);
  const [posted,setPosted] = useState([]);
  const info = attendance.data;
  const messages = conversationMessages(item.evidence,info?.messages ?? [],posted);
  useEffect(() => {
    if (posted.length && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [posted]);
  useEffect(() => {
    if (evidence && cited.current) {
      cited.current.scrollIntoView({block:"nearest"});
      cited.current.focus({preventScroll:true});
    }
  }, [item.id, evidence]);
  const favorite = useV2Action(context);
  const [schedule,setSchedule] = useState(false);
  const [scheduled,setScheduled] = useState(false);
  const [modal, setModal] = useState(null);
  const outcome = item.outcome;
  const confirmable = session.workspace.role === "manager" && outcome?.status === "won" && !outcome.confirmedAt;
  return <article className={css.thread} aria-label={"Atendimento de " + item.title}>
    <header className={css.threadHead}><a className={css.back} href="#entrada" aria-label="Voltar à lista de conversas"><ArrowLeft size={19} /></a>
      <span className={css.headerMark}><ContactMark s={{tone:"sage",initials:initials(item.title)}} /></span>
      <div className={css.identity}><div className={css.identityLine}><h2>{item.title}</h2></div><small>{item.source === "synthetic" ? "Conversa de exemplo" : "WhatsApp · Evolution API"}</small></div>
      <div className={css.threadUtilities}><IconAction className={css.headTool} disabled={favorite.pending}
        aria-label={item.favorite ? "Remover dos favoritos" : "Favoritar conversa"} aria-pressed={item.favorite}
        onClick={() => favorite.run("conversations/" + item.id + "/favorite","PUT",{favorite:!item.favorite},() => refresh())}>
        <Star size={16} fill={item.favorite ? "currentColor" : "none"} /></IconAction>
      <IconAction className={css.headTool} aria-label="Agendar retorno" onClick={() => setSchedule(true)}><CalendarClock size={16} /></IconAction>
      <Button size="sm" onClick={() => setModal({item,confirming:false})}>Desfecho</Button></div>
    </header>
    {focus}
    {favorite.error && <p role="alert">{favorite.error}</p>}
    {scheduled && <p role="status">Retorno agendado. <a href="#tarefas">Ver agenda</a></p>}
    {schedule && <ScheduleReturn item={item} context={context} close={ok => {setSchedule(false);if (ok) setScheduled(true);}} />}
    <div className={css.dialogue}><div ref={log} className={css.log} role="region" aria-label="Evidências da conversa">
      <div className={css.subject}><small>{item.pendingRevision ? "Atualização em andamento · Última leitura publicada" : "Leitura da conversa"}</small><h3>{item.summary}</h3></div>
      {evidence && !item.evidence.some(msg => encodeURIComponent(msg.externalId) === evidence) &&
        <p role="status">O trecho citado já não aparece na leitura atual.</p>}
      {messages.length ? messages.map(entry => {
        const msg = entry.evidence || entry.receipt;
        const outbound = Boolean(entry.receipt) || msg.direction === "outbound";
        const highlighted = entry.evidence && encodeURIComponent(msg.externalId) === evidence;
        return <div className={css.message} data-out={outbound} key={entry.key}
          {...(highlighted ? {ref:cited,tabIndex:-1,"data-highlight":true,"aria-label":"Trecho citado pela Zoe",role:"group"} : {})}>
          <small>{outbound ? "Equipe" : "Cliente"} · {new Date(entry.at).toLocaleString("pt-BR")}
            {entry.receipt && " · "+receiptLabel(entry.receipt.status,info?.mode)}</small><p>{msg.text}</p>
        </div>;
      }) : <p>Nenhuma evidência disponível.</p>}
      {outcome && <section className={css.brief} aria-label="Desfecho registrado"><h3>{outcomes[outcome.status]}</h3>
        {outcome.status === "won" && <p>{money(outcome.amountCents)} · {outcome.confirmedAt ? "Ganho confirmado" : "Aguardando confirmação do gestor"}</p>}
        {outcome.status === "lost" && <p>{outcome.lossReason}</p>}
        {confirmable && <Button size="sm" onClick={() => setModal({item,confirming:true})}>Revisar ganho</Button>}
      </section>}
    </div></div>
    {attendance.error ? <div role="status">Atendimento de texto indisponível. <Button variant="ghost" size="sm"
      onClick={attendance.retry}>Atualizar atendimento</Button></div> : info && <AttendanceComposer
      key={JSON.stringify([info.available,info.mode,info.contactName,info.lineName,info.destination])}
      path={path} context={context} info={info} refreshing={attendance.refreshing} reload={attendance.retry}
      received={msg => setPosted(previous => [...previous.filter(old => old.id !== msg.id),msg])} />}
    {modal && <OutcomeDialog item={modal.item} confirming={modal.confirming} context={context}
      close={() => setModal(null)} reload={() => {setModal(null);refresh();}}
      saved={value => {setModal(null);refresh(value);}} />}
  </article>;
}
export function ConnectedInbox({revision: listRevision, id, validId, context, session, refresh, evidence}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter,setFilter] = useState("all");
  const [mobile,setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width:700px), (max-width:860px) and (max-height:500px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change",update);
    return () => media.removeEventListener("change",update);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 230);
    return () => clearTimeout(timer);
  }, [search]);
  const inbox = useV2Page("conversations?q=" + encodeURIComponent(query) + (filter === "fav" ? "&favorite=true" : ""), context, listRevision);
  const [revision, setRevision] = useState(0);
  const [celebrate, setCelebrate] = useState(null);
  const detail = useV2Read(validId ? "conversations/" + id : null, context, revision);
  const focus = useV2Read("focus",context);
  const focusAction = useV2Action(context);
  const open = target => {location.hash = inboxHref(target);};
  const bar = <FocusBar read={focus} action={focusAction} currentId={validId ? id : null}
    candidate={detail.data?.id || inbox.data?.items[0]?.id} onOpen={open} />;
  const mobileThread = mobile && !!id;
  return <div className={css.inbox} data-thread={!!id}>
    <section className={css.list} aria-label="Lista de atendimentos"><div className={css.listHead}>{!mobileThread && bar}
      <SearchField label="Buscar conversas" value={search} maxLength={80} onValueChange={setSearch} placeholder="Buscar conversas…" /><Pills size="sm" label="Filtro da caixa" value={filter} onChange={setFilter}
        items={[{value:"all",label:"Todas"},{value:"fav",label:"Favoritas"}]} /></div>
      <div className={css.rows}><ReadState read={inbox}>{({items:matches}) => {
        return matches.length ? matches.map(item => <a className={css.row} href={inboxHref(item.id)}
          key={item.id} aria-current={id === item.id || undefined} onClick={e => {
            const round = focus.data?.round;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || round?.status !== "running" || round.conversationId === item.id) return;
            e.preventDefault();
            focusAction.run("focus/" + round.id,"PATCH",{action:"open",version:round.version,conversationId:item.id},() => {focus.retry();open(item.id);});
          }}><span className={css.rowMark}>
            <ContactMark s={{tone:"sage",initials:initials(item.title)}} /></span><span className={css.rowText}>
            <span className={css.rowTitle}><strong>{item.title}</strong>{item.favorite && <Star size={11} aria-label="Favorita" fill="currentColor" />}</span><small>{item.summary}</small></span></a>) :
          <p className={css.empty}>Nenhuma conversa identificada para este recorte.</p>;
      }}</ReadState><CursorNav page={inbox} label="Páginas da caixa de entrada" /></div>
    </section>
    <div className={css.read}>{!id ? <p className={css.blank}>Selecione uma conversa para ver as evidências.</p> :
      !validId ? <p>Conversa inválida. <a href="#entrada">Voltar à lista</a></p> :
      <ReadState read={detail}>{item => <Thread key={item.id} evidence={evidence} focus={mobileThread ? bar : null} item={item} context={context} session={session} refresh={value => {
        setRevision(n => n + 1); refresh();
        if (value && !value.confirmedAt && ["won","resolved"].includes(value.status))
          setCelebrate({status:value.status,at:value.recordedAt});
      }} />}</ReadState>}</div>
    {celebrate && <OutcomeCelebration key={celebrate.at} outcome={celebrate.status} />}
  </div>;
}
