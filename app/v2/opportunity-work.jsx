"use client";
import {useEffect,useRef,useState} from "react";
import {Button,ButtonLink,Input} from "@content-ventures/design-system/v3";
import {DetailRows} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {inboxHref,localDate} from "../../lib/inbox";
import {ReadState} from "./read-state";
import css from "../customer-inbox.module.css";

const stateNames={pending:"Ação pendente",watching:"Em acompanhamento",resolved:"Ação interna resolvida",review:"Revisão necessária",closed:"Pedido encerrado"};
const receipts={queued:"Envio na fila",dispatching:"Envio em andamento",accepted:"Mensagem aceita pelo canal",uncertain:"Entrega incerta",cancelled:"Envio cancelado",resolved:"Ação interna resolvida"};
function NewFollowup({path,item,context,close,saved}) {
  const action=useV2Action(context);
  return <ResponsiveDialog open title="Agendar retorno do pedido" description={item.title} size="sm" onClose={close} dismissible={!action.pending}>
    <form className="flow" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);
      action.run(path,"POST",{title:form.get("title").trim(),dueDate:form.get("date")},saved);
    }}><label>Próxima ação<Input name="title" required maxLength={240} /></label>
      <label>Data do retorno<Input name="date" type="date" required defaultValue={localDate()} /></label>
      {action.error&&<p role="alert">{action.error}</p>}<Button type="submit" disabled={action.pending}>Agendar para este pedido</Button>
    </form>
  </ResponsiveDialog>;
}
function Reconcile({receipt,context,close,saved}) {
  const action=useV2Action(context);
  return <ResponsiveDialog open title="Conferir envio incerto" size="sm" onClose={close} dismissible={!action.pending}>
    <form className="flow" onSubmit={event=>{event.preventDefault();
      action.run("commercial/actions/"+receipt.id+"/reconcile","POST",{providerMessageId:new FormData(event.currentTarget).get("messageId").trim()},saved);
    }}><p>Não há confirmação da entrega. O autor pode conferir uma mensagem já importada deste canal. Esta ação não reenvia o texto.</p>
      <label>Identificador da mensagem no canal<Input name="messageId" required maxLength={200} /></label>
      {action.error&&<p role="alert">{action.error}</p>}<Button type="submit" disabled={action.pending}>Conferir mensagem importada</Button>
    </form>
  </ResponsiveDialog>;
}
export function OpportunityWork({item,conversation,context,revision}) {
  const prefix="opportunities/"+item.id;
  const [tick,setTick]=useState(0), [confirm,setConfirm]=useState(null), [schedule,setSchedule]=useState(false), [reconcile,setReconcile]=useState(null);
  const reading=useV2Read(prefix+"/reading",context,revision+"/"+tick);
  const actions=useV2Read(prefix+"/actions",context,revision+"/"+tick);
  const followups=useV2Read(prefix+"/followups",context,revision+"/"+tick);
  const action=useV2Action(context);
  const reload=()=>{setConfirm(null);setTick(n=>n+1);};
  const latest=useRef(reload);latest.current=reload;
  const pending=actions.data?.items.some(a=>["queued","dispatching"].includes(a.state));
  useEffect(()=>{if(!pending)return;const timer=setInterval(()=>latest.current(),3000);return()=>clearInterval(timer);},[pending]);
  const closed=["won","lost"].includes(item.status);
  if(reading.error?.status===404)return null;
  return <section className={css.brief} aria-label="Trabalho da Zoe neste pedido">
    <h3>Trabalho da Zoe neste pedido</h3>
    <ReadState read={reading}>{data=>{
      const r=data.reading;
      if(!r)return <p role="status">Este pedido ainda aguarda uma leitura própria. O histórico do cliente continua disponível na conversa.</p>;
      const stale=r.stale===true||conversation.pendingRevision===true;
      const step=r.step, text=r.draftText?.trim(), writes=step?.writes===true;
      const ready=!closed&&!stale&&r.state==="pending"&&(writes?r.draftState==="ready"&&Boolean(text):step?.writes===false);
      const same=r.revision&&actions.data?.items.some(a=>a.revision===r.revision&&a.kind===(writes?"send":"internal")&&["queued","dispatching","accepted","uncertain","resolved"].includes(a.state));
      const sources=[...new Set(r.evidenceIds||[])].filter(id=>conversation.evidence?.some(m=>m.externalId===id));
      return <>
        <DetailRows items={[{label:"Leitura",value:r.summary||"Sem resumo"},{label:"Situação",value:stale?"Sugestão desatualizada":stateNames[r.state]||r.state},
          ...(step?.title?[{label:"Próximo passo",value:step.title}]:[]),...(step?.action?[{label:"O que fazer",value:step.action}]:[])]} />
        {stale?<p role="status">A conversa ou as fontes mudaram. Atualize a leitura antes de executar a sugestão.</p>:
          writes&&text&&r.draftState==="ready"?<blockquote>{text}</blockquote>:
          writes?<p role="status">{r.draftState==="no_quota"?"A redação aguarda liberação do limite de análise.":"A Zoe está preparando a redação deste pedido."}</p>:null}
        {!stale&&sources.length>0&&<nav aria-label="Fontes da sugestão do pedido">{sources.map((id,i)=><ButtonLink key={id} size="sm" variant="ghost" href={inboxHref(conversation.id)+"/evidencia/"+encodeURIComponent(id)}>Ver fonte {i+1}</ButtonLink>)}</nav>}
        {!stale&&writes&&text&&sources.length<(r.evidenceIds||[]).length&&<p role="status">Parte das fontes está fora desta leitura. Confira o histórico antes de usar a mensagem.</p>}
        {ready&&!same&&(writes&&conversation.source!=="evolution"?<p>Esta origem ainda não permite enviar a sugestão por aqui.</p>:
          <Button size="sm" disabled={action.pending} onClick={()=>setConfirm({kind:writes?"send":"internal",revision:r.revision,text,title:step.title})}>{writes?"Resolver e enviar sugestão":"Resolver ação interna"}</Button>)}
        <Button size="sm" variant="ghost" onClick={reload}>Atualizar trabalho do pedido</Button>
      </>;
    }}</ReadState>
    <h4>Recibos das ações</h4>
    <ReadState read={actions}>{data=>data.items.length?data.items.map(receipt=><section key={receipt.id} aria-label="Recibo da ação">
      <DetailRows items={[{label:"Ação",value:receipts[receipt.state]||receipt.state},{label:"Origem",value:receipt.origin==="automatic"?"Automática com consentimento":"Operador"},
        ...(receipt.reason?[{label:"Detalhe",value:receipt.reason}]:[])]} />
      {receipt.state==="uncertain"&&<><p>A entrega ficou incerta. Nenhum reenvio automático será feito.</p><Button variant="secondary" size="sm" onClick={()=>setReconcile(receipt)}>Conferir envio</Button></>}
    </section>):<p>Nenhuma ação executada para este pedido.</p>}</ReadState>
    <h4>Retornos deste pedido</h4>
    <ReadState read={followups}>{data=>data.items.length?<DetailRows items={data.items.map(task=>({label:task.title,value:task.dueDate.split("-").reverse().join("/")+" · "+(task.status==="completed"?"Concluído":"Em aberto")}))}/>:<p>Nenhum retorno agendado.</p>}</ReadState>
    {!closed&&<Button size="sm" variant="secondary" onClick={()=>setSchedule(true)}>Agendar retorno do pedido</Button>}
    {confirm&&<ResponsiveDialog open title={confirm.kind==="send"?"Enviar a sugestão da Zoe?":"Resolver a ação interna?"} size="sm" onClose={()=>setConfirm(null)} dismissible={!action.pending}>
      <div className="flow"><p>{confirm.kind==="send"?"A mensagem abaixo será reservada para envio neste pedido. O canal confirmará a entrega.":confirm.title}</p>
        {confirm.kind==="send"&&<blockquote>{confirm.text}</blockquote>}
        {action.error&&<p role="alert">{action.error}</p>}
        <Button disabled={action.pending} onClick={()=>action.run(prefix+"/resolve","POST",{expectedRevision:confirm.revision,kind:confirm.kind},reload)}>{action.pending?"Registrando…":confirm.kind==="send"?"Confirmar Resolver e enviar":"Confirmar ação interna"}</Button>
        {action.error&&<Button variant="ghost" onClick={reload}>Reler pedido</Button>}
      </div>
    </ResponsiveDialog>}
    {schedule&&<NewFollowup path={prefix+"/followups"} item={item} context={context} close={()=>setSchedule(false)} saved={()=>{setSchedule(false);reload();}} />}
    {reconcile&&<Reconcile receipt={reconcile} context={context} close={()=>setReconcile(null)} saved={()=>{setReconcile(null);reload();}} />}
  </section>;
}
