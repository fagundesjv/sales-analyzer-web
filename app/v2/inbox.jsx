"use client";
import {useEffect, useRef, useState} from "react";
import {Button, ButtonLink, SearchField} from "@content-ventures/design-system/v3";
import {ArrowLeft, CalendarClock, CheckCheck, ChevronRight, CircleMinus, MessageCircle, ScanText, SearchX, Star, Trophy} from "lucide-react";
import {IconAction} from "../../src/ui/os/icon-action";
import {FocusBar, ScheduleReturn} from "./seller-work";
import {Pills} from "../../src/ui/os/pills";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState} from "../../src/ui/os/empty-state";
import {inboxHref} from "../../lib/inbox";
import {money, parseMoney} from "../../lib/operation";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import {selfServeWhatsApp} from "../../lib/v2-capabilities";
import {ReaisField} from "../operation-fields";
import {OutcomeCelebration} from "../outcome-celebration";
import {ContactMark} from "../recovery-desk";
import {initials, outcomes} from "./work-queue";
import {CursorNav, ReadState} from "./read-state";
import {AttendanceComposer, conversationMessages, receiptLabel} from "./attendance";
import css from "../customer-inbox.module.css";
import first from "./inbox-onboarding.module.css";

const choices = [
  {status:"won",label:"Venda ganha",icon:Trophy},
  {status:"lost",label:"Venda perdida",icon:CircleMinus},
  {status:"resolved",label:"Resolver conversa",icon:CheckCheck},
];

function inboxNextStep(manager, lines) {
  if (lines.some(line => line.status === "connected")) return {
    title:"Sua linha está pronta para a primeira análise",
    description:"Inicie um diagnóstico. A Zoe lê as mensagens e traz as oportunidades para esta caixa.",
    label:"Iniciar diagnóstico", href:"#diagnosticos",
  };
  if (lines.some(line => line.source === "synthetic")) return {
    title:"Sua primeira leitura de exemplo",
    description:"Inicie um diagnóstico para explorar como a Zoe organiza as conversas de teste.",
    label:"Iniciar diagnóstico", href:"#diagnosticos",
  };
  const whatsapp = lines.filter(line => line.channel === "whatsapp" || line.source === "evolution");
  if (whatsapp.length) {
    const preparing = whatsapp.every(line => line.status === "provisioning");
    if (preparing) return {
      title:"Seu WhatsApp está em preparação",
      description:manager && selfServeWhatsApp ? "Abra a linha da equipe para continuar a conexão e acessar o QR Code." :
        "Acompanhe o estado da linha. Assim que ela estiver conectada, você poderá iniciar a análise.",
      label:manager && selfServeWhatsApp ? "Continuar conexão" : "Ver meus WhatsApps", href:"#whatsapps",
    };
    return {
      title:"Confira a conexão do WhatsApp",
      description:manager ? "Abra a linha para conferir o estado e escanear o QR Code, se necessário." :
        "Confira sua linha e peça ao gestor para concluir o pareamento, se necessário.",
      label:"Ver meus WhatsApps", href:"#whatsapps",
    };
  }
  return {
    title:"Toda conversa começa com uma conexão",
    description:manager ? selfServeWhatsApp ?
      "Conecte o WhatsApp da equipe para trazer as conversas e encontrar oportunidades com a Zoe." :
      "Solicite a conexão do WhatsApp à equipe de implantação para a Zoe identificar vendas a recuperar." :
      "Peça ao gestor para atribuir um WhatsApp à sua conta. Após a primeira análise, suas conversas aparecem aqui.",
    label:manager ? selfServeWhatsApp ? "Conectar WhatsApp" : "Ver orientações de conexão" : "Ver meus WhatsApps",
    href:"#whatsapps",
  };
}

function InboxOnboarding({session, lines}) {
  const step = inboxNextStep(session.workspace.role === "manager", lines);
  return <section className={first.page} aria-labelledby="inbox-first-title">
    <EmptyState size="page" icon={MessageCircle} preview="inbox" headingId="inbox-first-title"
      title={step.title} description={step.description}
      action={<ButtonLink variant="primary" shape="pill" className={first.cta} href={step.href}>
        {step.href === "#whatsapps" ? <span className={first.whatsapp} aria-hidden="true" /> : <ScanText aria-hidden="true" />}
        {step.label}</ButtonLink>} />
  </section>;
}
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
      <div className={css.identity}><div className={css.identityLine}><h2>{item.title}</h2></div><small>{item.source === "synthetic" ? "Conversa de exemplo" : "WhatsApp"}</small></div>
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
      }) : <EmptyState size="compact" icon={MessageCircle} preview="inbox" title="Sem mensagens nesta leitura"
        description="Os trechos de conversa disponíveis aparecerão aqui após a análise." />}
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
  const hasLoadedList = useRef(false);
  useEffect(() => {if (inbox.data) hasLoadedList.current = true;}, [inbox.data]);
  const firstAccess = !id && !search.trim() && !query && filter === "all" &&
    inbox.data?.items.length === 0 && !inbox.previous && !inbox.next;
  const connections = useV2Read(firstAccess ? "connections?limit=100" : null,context,listRevision);
  const focus = useV2Read(firstAccess ? null : "focus",context);
  const focusAction = useV2Action(context);
  const open = target => {location.hash = inboxHref(target);};
  const bar = <FocusBar read={focus} action={focusAction} currentId={validId ? id : null}
    candidate={detail.data?.id || inbox.data?.items[0]?.id} onOpen={open} />;
  const mobileThread = mobile && !!id;
  if (!id && !search.trim() && !query && filter === "all" && (inbox.error || (inbox.loading && !hasLoadedList.current)))
    return <ReadState read={inbox}>{() => null}</ReadState>;
  if (firstAccess) return <ReadState read={connections}>{data =>
    <InboxOnboarding session={session} lines={data.items} />}</ReadState>;
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
          <EmptyState size="compact" icon={query || filter !== "all" ? SearchX : MessageCircle}
            title={query || filter !== "all" ? "Nenhuma conversa encontrada" : inbox.previous ? "Esta página está vazia" :
              "As conversas aparecerão aqui"}
            description={query || filter !== "all" ? "Tente outro nome ou mostre todas as conversas." :
              inbox.previous ? "Volte para a página anterior." : session.workspace.role === "manager" ?
              "Conecte um WhatsApp e analise as mensagens para começar." :
              "Peça ao gestor para atribuir uma linha à sua conta."}
            action={query || filter !== "all" ? <Button size="sm" variant="secondary"
              onClick={() => {setSearch("");setQuery("");setFilter("all");}}>Mostrar todas</Button> :
              inbox.previous ? <Button size="sm" variant="secondary" onClick={inbox.previous}>Página anterior</Button> :
              <ButtonLink href="#whatsapps" size="sm" variant="secondary">Ver WhatsApps</ButtonLink>} />;
      }}</ReadState><CursorNav page={inbox} label="Páginas da caixa de entrada" /></div>
    </section>
    <div className={css.read}>{!id ? <EmptyState icon={MessageCircle}
      title={inbox.data?.items.length === 0 && !query && filter === "all" ? "Sua caixa está pronta" : "Escolha uma conversa"}
      description={inbox.data?.items.length === 0 && !query && filter === "all" ?
        "Quando as mensagens forem analisadas, você verá aqui o histórico e os próximos passos." :
        "Selecione um contato da lista para ver as mensagens, o risco e o desfecho."} /> :
      !validId ? <p>Conversa inválida. <a href="#entrada">Voltar à lista</a></p> :
      <ReadState read={detail} notFound={<EmptyState size="compact" icon={MessageCircle} title="Conversa indisponível"
        description="Consulte as conversas disponíveis para sua conta."
        action={<ButtonLink href="#entrada" size="sm">Voltar às conversas</ButtonLink>} />}>{item => <Thread key={item.id} evidence={evidence} focus={mobileThread ? bar : null} item={item} context={context} session={session} refresh={value => {
        setRevision(n => n + 1); refresh();
        if (value && !value.confirmedAt && ["won","resolved"].includes(value.status))
          setCelebrate({status:value.status,at:value.recordedAt});
      }} />}</ReadState>}</div>
    {celebrate && <OutcomeCelebration key={celebrate.at} outcome={celebrate.status} />}
  </div>;
}
