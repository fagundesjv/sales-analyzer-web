"use client";
import {useEffect,useRef,useState} from "react";
import {Button,ButtonLink,Conversation,Input,Menu} from "@content-ventures/design-system/v3";
import {ChevronDown,MessageCircle,Paperclip,Quote,Sparkles} from "lucide-react";
import {ZoeWelcome} from "../zoe-welcome";
import {ChatThread} from "../../src/ui/os/chat-home";
import {Composer,StripItem} from "../../src/ui/os/chat/composer";
import {Answer,AnswerContent,AnswerText,Ask} from "../../src/ui/os/chat/turns";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Action,useV2Read,v2Request} from "../../lib/v2-client";
import {inboxHref} from "../../lib/inbox";
import {ReadState} from "./read-state";
import {MemorySource} from "./memory-source";
import {exactReais} from "./work-queue";
import css from "./central-ai.module.css";
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const labels={visao_geral:"Abrir visão geral",zoe:"Abrir Zoe",conversas:"Abrir conversas",alertas:"Abrir alertas",diagnosticos:"Abrir diagnósticos",whatsapps:"Abrir WhatsApps",conectores:"Abrir conectores",produtos:"Abrir catálogo",equipe:"Abrir equipe",empresa:"Abrir empresa",novo_diagnostico:"Criar diagnóstico",conectar_whatsapp:"Conectar WhatsApp",convidar_pessoa:"Adicionar pessoa",abrir_diagnostico:"Abrir diagnóstico",pausar_zoe:"Pausar leituras da Zoe",retomar_zoe:"Retomar leituras da Zoe",atualizar_leitura:"Pedir uma leitura agora"};
const places={inicio:"#dashboard",zoe:"#chat",conversas:"#entrada",alertas:"#alertas",diagnosticos:"#diagnosticos",whatsapps:"#whatsapps",produtos:"#catalogo",equipe:"#equipe",empresa:"#empresa"};
const failures={indeterminate:"A execução ficou sem confirmação. O consumo segue em conferência; esta pergunta não será repetida automaticamente.",interrupted:"A pergunta foi interrompida. Faça outra consulta quando quiser.",authority_changed:"Os dados ou o seu acesso mudaram durante a consulta. Inicie uma pergunta com o contexto atual.",authority_or_operation_changed:"A operação mudou ou foi pausada. Confira os ajustes antes de consultar novamente.",invalid_response:"Não foi possível conferir a resposta com os dados disponíveis.",ai_unavailable:"A Zoe não conseguiu concluir a consulta agora.",callback_unavailable:"Não foi possível concluir a consulta agora."};
const factValue=f=>f.unit==="cents"?exactReais(String(f.value)):String(f.value);
function FactSource({turn,index,context,close}){
  const read=useV2Read("zoe/chat/turns/"+turn.id+"/sources/"+index,context),fact=read.data;
  if(fact?.kind==="memory"&&uuid.test(fact.sourceId||""))return <MemorySource sourceId={fact.sourceId} expectedVersion={fact.version} context={context} close={close} />;
  return <ResponsiveDialog open title="Fonte da resposta" onClose={close}>
    <ReadState read={read} notFound={<EmptyState icon={Quote} size="compact" title="Fonte indisponível" description="O conteúdo ou o seu acesso mudou desde esta pergunta." action={<Button onClick={close}>Voltar à resposta</Button>} />}>{f=><div className={css.form}>
      <strong>{f.label}</strong><AnswerText>{factValue(f)}</AnswerText>
      {f.kind==="attachment"&&<p>Arquivo privado anexado por você a esta pergunta.</p>}
      {uuid.test(f.conversationId||"")&&<ButtonLink href={inboxHref(f.conversationId)+(f.evidenceId?"/evidencia/"+encodeURIComponent(f.evidenceId):"")} icon={MessageCircle}>Abrir conversa</ButtonLink>}
    </div>}</ReadState>
  </ResponsiveDialog>;
}
function ActionConfirm({prepared,context,close,done}){
  const action=useV2Action(context),[receipt,setReceipt]=useState(null);
  const conflict=["zoe_action_revision_conflict","zoe_action_expired"].includes(action.errorCode);
  const leave=()=>{if(receipt)done();close();};
  function finish(value){setReceipt(value);const r=value.response;if(r?.kind==="navigation"&&places[r.destination]){const target=r.destination==="diagnosticos"&&uuid.test(r.target||"")?"/"+r.target:"";window.location.hash=places[r.destination]+target;close();}}
  return <ResponsiveDialog open title={prepared.label} onClose={action.pending?()=>{}:leave}>
    <div className={css.form}>
      <p>{prepared.command==="pausar_zoe"?"As novas leituras, sugestões e ações automáticas da Zoe ficarão pausadas. Operações já despachadas podem estar em andamento.":prepared.command==="retomar_zoe"?"A Zoe voltará a acompanhar as linhas selecionadas na frequência configurada.":prepared.command==="atualizar_leitura"?"Será solicitada uma leitura das linhas acompanhadas, respeitando o saldo e os limites da sua conta.":"Você abrirá esta área do produto. Os cadastros e alterações são concluídos no próprio fluxo."}</p>
      {receipt?<><p role="status">{receipt.response.kind==="operation_changed"?(receipt.response.paused?"Leituras pausadas.":"Leituras retomadas."):receipt.response.kind==="reading_requested"?"Leitura solicitada. Confira o andamento em Diagnósticos.":"Área aberta."}</p><Button onClick={leave}>Concluir</Button></>:<>
        {action.error&&<p role="alert">{action.error}</p>}
        <div className={css.actions}><Button disabled={action.pending||conflict} onClick={()=>action.run("zoe/actions/"+prepared.id+"/confirm","POST",{expectedRevision:prepared.revision,confirmed:true},finish)}>{action.pending?"Confirmando…":prepared.requiresConfirmation?"Confirmar ação":"Abrir área"}</Button><Button variant="ghost" disabled={action.pending} onClick={close}>Cancelar</Button></div>
      </>}
    </div>
  </ResponsiveDialog>;
}
function Upload({context,close,saved,maxBytes}){
  const action=useV2Action(context),[file,setFile]=useState(null),[reading,setReading]=useState(false),[error,setError]=useState("");
  return <ResponsiveDialog open title="Anexar arquivo privado" onClose={action.pending||reading?()=>{}:close}>
    <form className={css.form} onSubmit={async event=>{event.preventDefault();setError("");if(!file)return;if(file.size>maxBytes){setError("O arquivo deve ter até 12 MB.");return;}setReading(true);
      try{const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("Não foi possível ler o arquivo."));reader.readAsDataURL(file);});
        action.run("zoe/attachments","POST",{name:file.name,mime:file.type||(/\.csv$/i.test(file.name)?"text/csv":"text/plain"),content},saved);
      }catch(e){setError(e.message);}finally{setReading(false);}
    }}>
      <label>Arquivo para a Zoe<Input type="file" required accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,text/plain,.csv,.txt" onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
      <p>Até 4 arquivos por pergunta, 12 MB cada. Os arquivos são privados e expiram em 24 horas.</p>
      {(error||action.error)&&<p role="alert">{error||action.error}</p>}
      <Button type="submit" disabled={!file||action.pending||reading}>{action.pending||reading?"Anexando…":"Anexar à pergunta"}</Button>
    </form>
  </ResponsiveDialog>;
}
export function GroundedZoe({route,session,context,history}){
  const [page,id,extra]=route.split("/"),fromConversation=page==="chat"&&id==="origem"&&uuid.test(extra||"");
  const settings=useV2Read("zoe/chat",context),saved=useV2Read(page==="zoe"&&uuid.test(id||"")?"zoe/chat/turns/"+id:null,context);
  const [text,setText]=useState(""),[files,setFiles]=useState([]),[upload,setUpload]=useState(false),[citation,setCitation]=useState(null),[prepared,setPrepared]=useState(null);
  const [pending,setPending]=useState(null),[pollError,setPollError]=useState(""),[question,setQuestion]=useState("");
  const submit=useV2Action(context),prepare=useV2Action(context),active=useRef(true),storage="sa2-zoe-pending:"+context;
  useEffect(()=>{active.current=true;try{const id=sessionStorage.getItem(storage);if(uuid.test(id||""))setPending({id,state:"queued"});}catch{}return ()=>{active.current=false;};},[storage]);
  useEffect(()=>{
    if(!pending?.id)return;const controller=new AbortController();let timer;
    const check=async()=>{try{const result=await v2Request("zoe/chat/runs/"+pending.id,{context,signal:controller.signal});if(controller.signal.aborted)return;
      if(["queued","running"].includes(result.state)){timer=setTimeout(check,1000);return;}
      try{sessionStorage.removeItem(storage);}catch{}setPending(null);
      if(result.state==="done"&&result.turn){setText("");setFiles([]);history.first();settings.retry();window.location.hash="#zoe/"+result.turn.id;}
      else setPollError(failures[result.errorCode]||"A consulta não pôde ser concluída. Faça outra pergunta quando quiser.");
    }catch(e){if(!controller.signal.aborted){setPollError(e.message);if([401,403,404].includes(e.status)){setPending(null);try{sessionStorage.removeItem(storage);}catch{}}else timer=setTimeout(check,3000);}}};check();return()=>{controller.abort();clearTimeout(timer);};
  },[pending?.id,context,storage]);
  const turn=page==="zoe"?saved.data:null;
  function queued(result){if(!active.current)return;if(result.state==="done"&&result.turn){history.first();window.location.hash="#zoe/"+result.turn.id;return;}if(result.state==="failed"){setPollError(failures[result.errorCode]||"A consulta não pôde ser concluída.");return;}setPending(result);try{sessionStorage.setItem(storage,result.id);}catch{}}
  return <ReadState full read={settings}>{config=>{
    const busy=submit.pending||!!pending;
    const composer=<Composer label="Pergunta para a Zoe" formLabel="Consulta à Zoe" value={text} onChange={setText} placeholder="Pergunte sobre seus clientes, sua fila e sua operação" maxLength={500} minRows={turn?1:2}
      status={busy?"submitting":submit.error||pollError?"error":"idle"} disabled={config.paused} error={submit.error||pollError} submitLabel="Consultar Zoe" submitText="Consultar"
      onSubmit={value=>{setPollError("");setQuestion(value);submit.run("zoe/turns","POST",{question:value,...(fromConversation?{conversationId:extra}:{}),...(files.length?{attachmentIds:files.map(f=>f.id)}:{})},queued);}}
      attached={files.length>0&&<div className={css.actions}>{files.map(f=><Button key={f.id} size="sm" variant="ghost" disabled={busy} onClick={()=>setFiles(items=>items.filter(x=>x.id!==f.id))}>Remover {f.name}</Button>)}</div>}
      tools={<><Button size="sm" variant="ghost" icon={Paperclip} disabled={busy||files.length>=4} onClick={()=>setUpload(true)}>Anexar</Button><Menu label="Ações do produto" sections={[{items:config.commands.filter(c=>c!=="abrir_diagnostico").map(command=>({label:labels[command],onSelect:()=>prepare.run("zoe/actions","POST",{command},setPrepared)}))}]} trigger={props=><Button {...props} size="sm" variant="ghost" trailingIcon={ChevronDown} disabled={prepare.pending}>Ações</Button>} /></>}
      strip={<StripItem icon={Sparkles}>{fromConversation?"Contexto desta conversa":"Dados autorizados e sua memória privada"}</StripItem>}
      note={config.paused?"As leituras estão pausadas. Use as ações para retomar.":`${config.daily.used} de ${config.daily.limit} perguntas usadas hoje. Ações são confirmadas antes de executar.`} />;
    const answer=<>{turn&&<><Ask>{turn.query.question}</Ask><Answer name="Zoe" working={false} meta={new Date(turn.createdAt).toLocaleString("pt-BR")}><AnswerText>{turn.answer}</AnswerText>
      {turn.citations.length>0&&<div className="zoe-sources"><small>Fontes da resposta</small>{turn.citations.map((f,index)=><AnswerContent key={f.ref} title={f.label} meta={f.kind==="memory"&&f.scope==="private"?"Sua memória privada":f.kind==="attachment"?"Seu anexo":undefined} thumb={<Quote size={16} aria-hidden="true" />} onOpen={()=>setCitation(index)} />)}</div>}
      {turn.result.actions?.map(a=><Button key={a.id} variant="secondary" size="sm" onClick={()=>setPrepared(a)}>{a.label}</Button>)}
    </Answer></>}{pending&&<><Ask>{question||"Consulta em processamento"}</Ask><Answer name="Zoe" working activity="Consultando informações autorizadas" /></>}{prepare.error&&<p role="alert">{prepare.error}</p>}</>;
    return <>
      {page==="zoe"&&id?<ReadState full read={saved} notFound={<EmptyState icon={Sparkles} title="Consulta indisponível" description="O contexto ou o seu acesso mudou. Consulte os dados atuais." action={<ButtonLink href="#chat">Nova pergunta</ButtonLink>} />}>{()=> <ChatThread><Conversation label="Conversa com a Zoe" footer={composer}>{answer}</Conversation></ChatThread>}</ReadState>:
        pending?<ChatThread><Conversation label="Conversa com a Zoe" footer={composer}>{answer}</Conversation></ChatThread>:<ZoeWelcome company={session.workspace.name}>{composer}{prepare.error&&<p role="alert">{prepare.error}</p>}</ZoeWelcome>}
      {upload&&<Upload context={context} maxBytes={config.attachments.maxBytes} close={()=>setUpload(false)} saved={f=>{if(active.current){setFiles(items=>[...items,f]);setUpload(false);}}} />}
      {citation!==null&&turn&&<FactSource turn={turn} index={citation} context={context} close={()=>setCitation(null)} />}
      {prepared&&<ActionConfirm prepared={prepared} context={context} close={()=>setPrepared(null)} done={()=>settings.retry()} />}
    </>;
  }}</ReadState>;
}
