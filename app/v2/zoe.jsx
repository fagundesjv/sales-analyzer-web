"use client";

import {useEffect, useRef, useState} from "react";
import {Button, ButtonLink, Conversation, Menu, SearchField} from "@content-ventures/design-system/v3";
import {ChartColumn, ChevronDown, MessageCircle, Quote, Radar, SearchX, Sparkles} from "lucide-react";
import {ZoeWelcome} from "../zoe-welcome";
import {ChatThread} from "../../src/ui/os/chat-home";
import {Composer, StripItem} from "../../src/ui/os/chat/composer";
import {Answer, AnswerContent, AnswerText, Ask} from "../../src/ui/os/chat/turns";
import {SessionRows} from "../../src/ui/os/session-rows";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Action, useV2Page, useV2Read, v2Request} from "../../lib/v2-client";
import {inboxHref} from "../../lib/inbox";
import {CursorNav, ReadState} from "./read-state";
import {exactReais} from "./work-queue";
import s from "./zoe.module.css";
import {GroundedZoe} from "./zoe-grounded";

const subjects = {
  summary: {label:"Resumo da operação", question:"Como está a minha operação?", icon:ChartColumn},
  radar: {label:"Prioridades do Radar", question:"Quais oportunidades devo priorizar?", icon:Radar},
  conversation: {label:"Analisar conversa", question:"O que a leitura desta conversa mostra?", icon:MessageCircle},
};
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const when = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"});
const turnTitle = turn => turn.query.question || subjects[turn.query.type]?.question || "Consulta à Zoe";
const turnHref = (turn, cursor) => "#zoe/" + turn.id + (cursor ? "/" + cursor : "");

export function ZoeHistory({history, route}) {
  return <ReadState retain read={history}>{({items}) => <>
    <SessionRows label="Perguntas anteriores" current={route}
      empty={<EmptyState size="compact" icon={Sparkles} preview={history.previous ? undefined : "zoe"} title={history.previous ? "Esta página está vazia" : "Sua história com a Zoe começa aqui"}
        description={history.previous ? "Volte à página anterior para ver suas consultas." : "Pergunte à Zoe sobre sua operação. As consultas ficam salvas aqui."} />}
      groups={[{id:"personal",label:"Minhas consultas",rows:items.map(turn => ({
        id:turnHref(turn,history.cursor).slice(1),href:turnHref(turn,history.cursor),title:turnTitle(turn),
        meta:new Date(turn.createdAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}),
      }))}]} />
    <CursorNav page={history} label="Páginas do histórico da Zoe" />
  </>}</ReadState>;
}

// History is the authorized read endpoint for a turn. A saved link may outlive its original page.
function useSavedTurn(id, cursor, context, history) {
  const [lookup,setLookup] = useState({});
  const [retry,setRetry] = useState(0);
  const visibleTurn = history.data?.items.find(turn => turn.id === id);
  const needsLookup = Boolean(id && uuid.test(id) && history.data && !visibleTurn);
  useEffect(() => {
    if (!needsLookup) return;
    const controller = new AbortController();
    const seen = new Set();
    async function find() {
      const scan = async start => {
        let next = start;
        do {
          if (seen.has(next)) break;
          seen.add(next);
          const page = await v2Request("zoe/history?limit=50" + (next ? "&cursor=" + next : ""),
            {context,signal:controller.signal});
          const turn = page.items.find(item => item.id === id);
          if (turn) return turn;
          next = page.nextCursor;
        } while (next);
      };
      let anchored;
      if (cursor && uuid.test(cursor)) {
        try {anchored = await scan(cursor);}
        catch (error) {if (error.status !== 404 && error.status !== 400) throw error;}
      }
      const data = anchored || await scan(null);
      if (!controller.signal.aborted) setLookup({id,data:data || null});
    }
    find().catch(error => {if (!controller.signal.aborted) setLookup({id,error});});
    return () => controller.abort();
  },[id,cursor,context,needsLookup,retry]);
  if (id && !uuid.test(id)) return {data:null};
  if (visibleTurn) return {data:visibleTurn};
  if (history.error || history.loading) return history;
  if (lookup.id !== id) return {loading:true};
  return {...lookup,retry:() => {setLookup({});setRetry(n => n+1);}};
}

function ConversationPicker({context, select, close}) {
  const [text,setText] = useState("");
  const [query,setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()),200);
    return () => clearTimeout(timer);
  },[text]);
  const list = useV2Page("conversations?q=" + encodeURIComponent(query),context,0,10);
  return <ResponsiveDialog open title="Escolher conversa" onClose={close}><div className="flow">
    <SearchField label="Buscar conversa para a Zoe" value={text} maxLength={80} onValueChange={setText} placeholder="Buscar contato ou conversa…" />
    <ReadState retain pending={text.trim() !== query} read={list}>{({items}) => items.length ? <ul className={s.choices}>
      {items.map(row => <li key={row.id}><button type="button" onClick={() => select(row)}>
        <strong>{row.title}</strong><small>{row.summary}</small></button></li>)}
    </ul> : <EmptyState size="compact" icon={query ? SearchX : MessageCircle} preview={query || list.previous ? undefined : "inbox"}
      title={list.previous ? "Esta página está vazia" : query ? "Nenhuma conversa encontrada" : "Nenhuma conversa disponível"}
      description={list.previous ? "Volte para a página anterior de conversas." : query ? "Tente outro contato para perguntar à Zoe." :
        "As conversas analisadas da sua operação aparecerão aqui."}
      action={list.previous ? <Button size="sm" onClick={list.previous}>Página anterior</Button> : query ? <Button size="sm" variant="secondary" onClick={() => {setText("");setQuery("");}}>Limpar busca</Button> : <ButtonLink size="sm" href="#entrada" onClick={close}>Abrir conversas</ButtonLink>} />}</ReadState>
    <CursorNav page={list} pending={text.trim() !== query} label="Páginas de conversas para a Zoe" />
  </div></ResponsiveDialog>;
}

function Citation({turn, index, context, close}) {
  const read = useV2Read("zoe/turns/" + turn.id + "/citations/" + index,context);
  return <ResponsiveDialog open title="Fonte da resposta" onClose={close}>
    <ReadState read={read} notFound={<EmptyState size="compact" icon={Quote} title="Fonte indisponível"
      description="O trecho citado não está disponível para esta consulta."
      action={<Button size="sm" onClick={close}>Voltar à resposta</Button>} />}>{({citation,evidence}) => <div className={s.source}>
      <h3>{citation.conversationTitle}</h3>
      <small>{evidence.direction === "outbound" ? "Equipe" : "Cliente"} · {when.format(new Date(evidence.occurredAt))}</small>
      <blockquote>{evidence.text}</blockquote>
      <ButtonLink href={inboxHref(citation.conversationId) + "/evidencia/" + encodeURIComponent(citation.evidenceId)}
        icon={MessageCircle}>Abrir conversa</ButtonLink>
    </div>}</ReadState>
  </ResponsiveDialog>;
}

function Result({turn}) {
  const result = turn.result;
  if (result.type === "summary") {
    const data = result.summary;
    return <dl className={s.facts}>
      <div><dt>Ganhos confirmados</dt><dd>{exactReais(data.confirmedWins.amountCents)}</dd></div>
      <div><dt>A confirmar</dt><dd>{exactReais(data.pendingWins.amountCents)}</dd></div>
    </dl>;
  }
  if (result.type === "conversation") return <ButtonLink size="sm" variant="secondary"
    href={inboxHref(result.item.conversationId)} icon={MessageCircle}>Abrir {result.item.title}</ButtonLink>;
  if (!result.items.length) return null;
  return <div className={s.links}>{result.items.map(item => <a key={item.conversationId}
    href={inboxHref(item.conversationId)}>{item.title}</a>)}
    {result.hasMore && <a href="#radar">Ver fila completa</a>}</div>;
}

function Chat({settings, turn, origin, source, session, context, onSaved}) {
  const active = useRef(true);
  useEffect(() => {active.current = true; return () => {active.current = false;};},[]);
  const inherited = turn?.query.type === "conversation" ? turn.result.item : null;
  const [target,setTarget] = useState(source || (inherited ? {id:inherited.conversationId,title:inherited.title} : null));
  const preferred = target ? "conversation" : turn?.query.type || (origin === "radar" ? "radar" : "summary");
  const available = settings.queryTypes.filter(type => Object.hasOwn(subjects,type));
  const [type,setType] = useState(available.includes(preferred) ? preferred : available[0]);
  const [text,setText] = useState("");
  const [picking,setPicking] = useState(false);
  const [citation,setCitation] = useState(null);
  const action = useV2Action(context);
  if (!type || settings.mode !== "deterministic") return <p role="status">As consultas da Zoe estão indisponíveis nesta sessão.</p>;
  function choose(value) {
    if (value === "conversation" && !target) setPicking(true);
    else setType(value);
  }
  function submit(value) {
    if (type === "conversation" && !target) {setPicking(true);return;}
    const query = {type};
    if (value.trim()) query.question = value.trim();
    if (type === "conversation") query.conversationId = target.id;
    action.run("zoe/queries","POST",query,saved => {if (active.current) onSaved(saved);});
  }
  const box = <Composer label="Pergunta para a Zoe" formLabel="Consulta à Zoe"
    value={text} onChange={setText} placeholder={subjects[type].question} maxLength={500}
    minRows={turn ? 1 : 2} allowEmpty status={action.pending ? "submitting" : action.error ? "error" : "idle"}
    onSubmit={submit} error={action.error} submitLabel="Consultar Zoe" submitText="Consultar"
    tools={<Menu label="Escolher consulta" sections={[{items:available.map(value => ({
      label:subjects[value].label,icon:subjects[value].icon,onSelect:() => choose(value),
    }))}]} trigger={props => <Button {...props} disabled={action.pending} variant="ghost" size="sm"
      icon={subjects[type].icon} trailingIcon={ChevronDown}>{subjects[type].label}</Button>} />}
    strip={<><StripItem icon={Sparkles}>Consulta local por regras</StripItem>
      {type === "conversation" && target && <button type="button" className={s.target} disabled={action.pending}
        onClick={() => setPicking(true)} title="Trocar conversa">{target.title}</button>}</>}
    note="Escolha a consulta. Se quiser, dê um título à pergunta para encontrá-la no histórico."
  />;
  return <>
    {turn ? <ChatThread><Conversation label="Conversa com a Zoe" footer={box}>
      <Ask role="user">{turnTitle(turn)}</Ask>
      <Answer role="assistant" name="Zoe" working={false} meta={[
        "Consulta local",
        turn.result.type === "summary" && ({synthetic:"Dados de teste",evolution:"WhatsApp",mixed:"WhatsApp e dados de teste"})[turn.result.summary.source],
        when.format(new Date(turn.createdAt)),
      ].filter(Boolean).join(" · ")}>
        <div className="zoe-byline"><img src="/assets/idle_thumbnail.png" width="28" height="28" alt="" /><strong>Zoe</strong></div>
        <AnswerText>{turn.answer}</AnswerText><Result turn={turn} />
        {turn.citations.length > 0 && <div className="zoe-sources"><small>Fontes da resposta</small>
          {turn.citations.map(entry => <AnswerContent key={entry.index} title={entry.conversationTitle}
            meta={entry.excerpt} thumb={<Quote size={16} aria-hidden="true" />} onOpen={() => setCitation(entry.index)} />)}
        </div>}
      </Answer>
    </Conversation></ChatThread> : <ZoeWelcome company={session.workspace.name}
      contactName={type === "conversation" ? target?.title : null}>{box}</ZoeWelcome>}
    {picking && <ConversationPicker context={context} close={() => setPicking(false)}
      select={row => {setTarget(row);setType("conversation");setPicking(false);}} />}
    {citation !== null && <Citation turn={turn} index={citation} context={context} close={() => setCitation(null)} />}
  </>;
}

function LegacyConnectedZoe({route,session,context,history}) {
  const [page,id,extra] = route.split("/");
  const settings = useV2Read("zoe/session",context);
  const saved = useSavedTurn(page === "zoe" ? id : null,extra,context,history);
  const fromConversation = page === "chat" && id === "origem";
  const source = useV2Read(fromConversation && uuid.test(extra || "") ? "conversations/" + extra : null,context);
  function view(turn,source) {
    return <Chat settings={settings.data} turn={turn} origin={id} source={source}
      session={session} context={context} onSaved={result => {history.first();window.location.hash = turnHref(result);}} />;
  }
  return <ReadState full read={settings}>{() => {
    if (fromConversation) return uuid.test(extra || "") ? <ReadState full read={source} notFound={<EmptyState size="compact" icon={MessageCircle} title="Conversa indisponível"
      description="Escolha outra conversa ao fazer a pergunta."
      action={<ButtonLink href="#chat" size="sm">Abrir o chat da Zoe</ButtonLink>} />}>{row => view(null,row)}</ReadState> :
      <p role="alert">Conversa inválida. <a href="#chat">Abrir o chat da Zoe</a></p>;
    if (page === "zoe" && id) return <ReadState full read={saved}>{turn => turn ? view(turn,null) :
      <EmptyState icon={Sparkles} size="compact" title="Consulta indisponível para esta conta"
        description="Inicie outra pergunta para consultar os dados disponíveis." action={<ButtonLink href="#chat" size="sm">Nova pergunta</ButtonLink>} />}</ReadState>;
    return view(null,null);
  }}</ReadState>;
}
export function ConnectedZoe(props){return props.session.capabilities?.zoeChat===true?<GroundedZoe {...props} />:<LegacyConnectedZoe {...props} />;}
