"use client";
import {useEffect, useState} from "react";
import {Button, ButtonLink, Input, PageHeader} from "@content-ventures/design-system/v3";
import {ArrowUpRight, KanbanSquare, MessageCircle, SearchX} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState, FirstAccess} from "../../src/ui/os/empty-state";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import {CursorNav, ReadState} from "./read-state";
import boardStyle from "../recovery-desk.module.css";
import pageStyle from "./pipeline.module.css";

const cardsPerStage = "8";

function useChoices(path, context, revision = 0) {
  const list = useV2Page(path,context,revision,100);
  const [earlier, setEarlier] = useState({revision,items:[]});
  const items = earlier.revision===revision ? earlier.items : [];
  const merge = new Map([...items, ...(list.data?.items ?? [])].map(item => [item.id,item]));
  const more = list.next && (() => {setEarlier({revision,items:[...merge.values()]});list.next();});
  return {...list,items:[...merge.values()], more};
}
function ConflictError({action, refresh}) {
  if (!action.error) return null;
  return <div className={pageStyle.error} role="alert"><p>{action.error}</p>
    {action.errorCode==="pipeline_version_conflict" &&
      <Button type="button" variant="secondary" onClick={refresh}>Recarregar pipeline</Button>}
  </div>;
}
function PipelineEditor({existing, context, close, save, refresh}) {
  const action = useV2Action(context);
  const [name,setName] = useState(existing?.name ?? "");
  const [stages,setStages] = useState(() => (existing?.stages ?? [
    {name:"Proposta"}, {name:"Follow-up"}, {name:"Negociação"},
  ]).map((stage,index) => ({id:stage.id,name:stage.name,key:stage.id ?? String(index)})));
  const [lastKey,setLastKey] = useState(stages.length);
  const stale = action.errorCode==="pipeline_version_conflict";
  const valid = name.trim() && stages.length && stages.every(stage => stage.name.trim());

  function reorder(from,to) {
    setStages(previous => {
      const next=[...previous];
      [next[from],next[to]]=[next[to],next[from]];
      return next;
    });
  }
  function submit(event) {
    event.preventDefault();
    if (!valid || action.pending || stale) return;
    const body={name:name.trim(),stages:stages.map(({id,name:label}) =>
      id ? {id,name:label.trim()} : {name:label.trim()})};
    action.run(existing ? "pipelines/"+existing.id : "pipelines",existing ? "PATCH" : "POST",
      existing ? {...body,version:existing.version} : body,save);
  }
  return <ResponsiveDialog open onClose={close} size="md" title={existing ? "Editar funil" : "Novo funil"}
    footer={<Button type="submit" form="pipeline-config" variant="primary" disabled={!valid || action.pending || stale}>
      {action.pending ? "Salvando…" : "Salvar funil"}</Button>}>
    <form id="pipeline-config" className={pageStyle.form} onSubmit={submit}>
      <label>Nome do funil<Input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
      <section aria-label="Etapas do funil" className={pageStyle.stages}>
        {stages.map((stage,index) => <div className={pageStyle.stageRow} key={stage.key}>
          <label>Etapa {index+1}<Input required maxLength={80} value={stage.name}
            onChange={event => setStages(previous => previous.map(item =>
              item.key===stage.key ? {...item,name:event.target.value} : item))} /></label>
          <div className={pageStyle.stageActions}>
            <Button type="button" variant="ghost" size="sm" aria-label={"Subir etapa "+(index+1)}
              disabled={!index} onClick={() => reorder(index,index-1)}>Subir</Button>
            <Button type="button" variant="ghost" size="sm" aria-label={"Descer etapa "+(index+1)}
              disabled={index===stages.length-1} onClick={() => reorder(index,index+1)}>Descer</Button>
            <Button type="button" variant="ghost" size="sm" aria-label={"Remover etapa "+(index+1)}
              disabled={stages.length===1 || (!!existing && stage.id===existing.initialStageId)}
              onClick={() => setStages(previous => previous.filter(item => item.key!==stage.key))}>Remover</Button>
          </div>
        </div>)}
      </section>
      <Button type="button" variant="secondary" size="sm" disabled={stages.length===12}
        onClick={() => {setStages(previous => [...previous,{key:String(lastKey),name:""}]);setLastKey(lastKey+1);}}>
        Adicionar etapa
      </Button>
      <ConflictError action={action} refresh={refresh} />
    </form>
  </ResponsiveDialog>;
}
function MoveCard({card, board, directory, context, close, save, refresh}) {
  const action = useV2Action(context);
  const [destination,setDestination] = useState(board.id);
  const [stage,setStage] = useState(card.stageId);
  const options = directory.items.some(item => item.id===board.id) ? directory.items : [board,...directory.items];
  const target = options.find(item => item.id===destination);
  const stale = action.errorCode==="pipeline_version_conflict";
  const changed = stage && (destination!==board.id || stage!==card.stageId);
  return <ResponsiveDialog open size="sm" title="Mover negociação" description={card.title} onClose={close}
    footer={<Button type="submit" form="move-pipeline-card" variant="primary" disabled={!changed || action.pending || stale}>
      {action.pending ? "Movendo…" : "Confirmar movimento"}</Button>}>
    <form id="move-pipeline-card" className={pageStyle.form} onSubmit={event => {
      event.preventDefault();
      if (!changed || action.pending || stale) return;
      action.run("conversations/"+card.id+"/pipeline","PUT",{pipelineId:destination,stageId:stage,version:card.version},save);
    }}>
      <label>Funil de destino<select aria-label="Funil de destino" value={destination} onChange={event => {
        const id=event.target.value;
        setDestination(id);
        setStage(options.find(item => item.id===id)?.initialStageId ?? "");
      }}>
        {options.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>
      {directory.more && <Button type="button" variant="ghost" size="sm" onClick={directory.more}>Carregar mais funis</Button>}
      <label>Etapa de destino<select aria-label="Etapa de destino" value={stage} onChange={event => setStage(event.target.value)}>
        {target?.stages.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>
      <ConflictError action={action} refresh={refresh} />
    </form>
  </ResponsiveDialog>;
}
function Lane({stage,boardId,owner,context,showMove}) {
  const [cursors,setCursors] = useState([null]);
  const cursor=cursors.at(-1);
  const suffix=new URLSearchParams({limit:cardsPerStage,...(owner?{assigneeId:owner}:{}),...(cursor?{cursor}:{})});
  const read=useV2Read(cursor ? "pipelines/"+boardId+"/stages/"+stage.id+"/cards?"+suffix : null,context);
  const current=cursor ? read : {data:stage};
  const page={number:cursors.length,
    next:current.data?.nextCursor ? () => setCursors(previous => [...previous,current.data.nextCursor]) : null,
    previous:cursors.length>1 ? () => setCursors(previous => previous.slice(0,-1)) : null,
  };
  return <section className={boardStyle.lane} aria-label={stage.name}>
    <header className={boardStyle.laneTitle}>
      <h2>{stage.name}</h2><small aria-label={stage.total+" negociações"}>{stage.total}</small>
    </header>
    <CursorNav label={"Páginas de "+stage.name} page={page} className={pageStyle.pagination} />
    <ReadState read={current}>{data => data.items.length ? data.items.map(card => <article key={card.id} className={boardStyle.deal}>
      <a href={"#entrada/todos/"+card.id}><b>{card.title}</b><ArrowUpRight size={16} aria-hidden="true" /></a>
      <p>{card.summary}</p>
      <div className={boardStyle.dealFoot}><small>{card.ownerName}</small>
        <Button size="sm" variant="ghost" aria-label={"Mover negociação "+card.title} onClick={() => showMove(card)}>Mover</Button>
      </div>
    </article>) : <EmptyState size="compact" icon={KanbanSquare}
      title={page.previous ? "Esta página está vazia" : owner ? "Sem negociações deste responsável" : "Etapa livre"}
      description={page.previous ? "Volte à página anterior." : "As conversas analisadas nesta etapa aparecerão aqui."}
      action={page.previous ? <Button size="sm" variant="ghost" onClick={page.previous}>Página anterior</Button> : null} />}</ReadState>
  </section>;
}
export function ConnectedPipeline({session,context}) {
  const manager=session.workspace.role==="manager";
  const [selected,setSelected] = useState("");
  const [owner,setOwner] = useState("");
  const [dialog,setDialog] = useState(null);
  const [revision,setRevision] = useState(0);
  const [notice,setNotice] = useState("");
  const directory=useChoices("pipelines",context,revision);
  const people=useChoices(manager?"team":null,context);
  const [preferred,setPreferred] = useState("");
  const id=selected || directory.data?.defaultPipelineId || directory.items[0]?.id || preferred;
  useEffect(() => {if (directory.data?.defaultPipelineId) setPreferred(directory.data.defaultPipelineId);},
    [directory.data?.defaultPipelineId]);
  const query=new URLSearchParams({limit:cardsPerStage,...(owner?{assigneeId:owner}:{})});
  const board=useV2Read(id?"pipelines/"+id+"?"+query:null,context,revision);

  function refresh() {
    setDialog(null);
    setRevision(previous => previous+1);
  }
  function saved(result) {
    if (dialog?.kind==="pipeline") setSelected(result.id);
    setNotice(dialog?.kind==="pipeline" ? "Funil salvo." : "Negociação movida.");
    refresh();
  }
  const editor = dialog?.kind==="pipeline" && <PipelineEditor existing={dialog.board} context={context}
      close={() => setDialog(null)} save={saved} refresh={refresh} />;
  if (!id) return <><ReadState read={directory}>{() => <FirstAccess icon={KanbanSquare} preview="pipeline"
      title="Organize as negociações por etapa"
      description={manager ? "Crie o primeiro funil para acompanhar as conversas analisadas." :
        "O gestor ainda não configurou um funil para esta empresa."}
      action={manager && <Button variant="primary" onClick={() => setDialog({kind:"pipeline"})}>Criar funil</Button>} />}</ReadState>
    {editor}</>;
  return <div className={boardStyle.desk} data-stable-phone-tabs>
    <PageHeader title="Pipeline comercial" actions={<ButtonLink href="#tarefas" icon={MessageCircle}>Retornos agendados</ButtonLink>} />
      <div className={pageStyle.toolbar}>
        <label>Funil<select aria-label="Funil" value={id} onChange={event => {setSelected(event.target.value);setNotice("");}}>
          {!directory.items.some(item => item.id===id) && <option value={id}>{board.data?.name ?? "Funil selecionado"}</option>}
          {directory.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        {directory.more && <Button size="sm" variant="ghost" onClick={directory.more}>Carregar mais funis</Button>}
        {manager && <>
          <label>Responsável<select aria-label="Responsável" value={owner} onChange={event => setOwner(event.target.value)}>
            <option value="">Toda a equipe</option>
            {people.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {people.more && <Button size="sm" variant="ghost" onClick={people.more}>Carregar mais responsáveis</Button>}
          <Button size="sm" variant="secondary" disabled={!board.data}
            onClick={() => setDialog({kind:"pipeline",board:board.data})}>Editar funil</Button>
          <Button size="sm" variant="primary" onClick={() => setDialog({kind:"pipeline"})}>Novo funil</Button>
        </>}
      </div>
      {directory.error && <ReadState read={directory}>{() => null}</ReadState>}
      {manager && people.error && <ReadState read={people}>{() => null}</ReadState>}
      {notice && <p role="status">{notice}</p>}
      <ReadState read={board}>{data => owner && data.stages.every(stage => stage.total === 0) ?
        <EmptyState size="section" icon={SearchX} title="Nenhuma negociação deste responsável"
          description="Mostre toda a equipe para consultar as negociações deste funil."
          action={<Button size="sm" onClick={() => setOwner("")}>Mostrar toda a equipe</Button>} /> :
        <div className={boardStyle.board+" "+pageStyle.board}
        aria-label="Quadro de negociações">
        {data.stages.map(stage => <Lane key={[id,owner,revision,stage.id].join("/")} stage={stage} boardId={id}
          owner={owner} context={context} showMove={card => setDialog({kind:"move",card,board:data})} />)}
      </div>}</ReadState>
    {editor}
    {dialog?.kind==="move" && <MoveCard card={dialog.card} board={dialog.board} directory={directory} context={context}
      close={() => setDialog(null)} save={saved} refresh={refresh} />}
  </div>;
}
