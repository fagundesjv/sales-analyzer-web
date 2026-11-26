"use client";
import {useState} from "react";
import {Button,Input,Textarea} from "@content-ventures/design-system/v3";
import {DetailRows,DetailSection,DetailText} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import css from "./central-ai.module.css";
const names={nowz:"Nowz",whatsapp:"WhatsApp",evolution:"WhatsApp",datacrazy:"Datacrazy"};
function ConnectNowz({context,close,saved}) {
  const action=useV2Action(context);
  return <ResponsiveDialog open title="Conectar Nowz" size="sm" onClose={close} dismissible={!action.pending}>
    <form className={css.form} onSubmit={event=>{
      event.preventDefault();const form=new FormData(event.currentTarget);
      action.run("sources/nowz","POST",{name:form.get("name").trim(),credentialRef:form.get("binding").trim(),channelIds:form.get("channels").split(/[\n,]+/).map(x=>x.trim()).filter(Boolean)},saved);
    }}>
      <p>Use o código de conexão e os canais autorizados da conta Nowz da sua empresa. A conexão será conferida antes de importar conversas.</p>
      <label>Nome da conexão<Input name="name" required minLength={2} maxLength={60} /></label>
      <label>Código de conexão<Input name="binding" required maxLength={100} /></label>
      <label>Canais da conta Nowz<Textarea aria-label="Canais da conta Nowz" name="channels" required rows={4} placeholder="Um código de canal por linha" /></label>
      <p>Esta integração importa conversas. O envio de mensagens por Nowz ainda não está disponível.</p>
      {action.error&&<p role="alert">{action.error}</p>}
      <Button type="submit" disabled={action.pending}>Conferir e conectar Nowz</Button>
    </form>
  </ResponsiveDialog>;
}
export function SourceCatalog({context,session}) {
  const read=useV2Read("sources/capabilities",context),[connecting,setConnecting]=useState(false),[notice,setNotice]=useState("");
  if(read.error?.status===404)return null;
  return <DetailSection title="Sistemas de atendimento">
    <ReadState read={read}>{data=><>
      {data.providers.filter(p=>!["whatsapp","evolution"].includes(p.id)).map(provider=><section key={provider.id} aria-label={names[provider.id]||provider.id}>
        <h3>{names[provider.id]||provider.id}</h3>
        <p>{provider.reason==="setup_required"?"Solicite a conexão da sua conta Nowz.":provider.available!==true?"Conexão em avaliação. A importação será liberada após a validação da integração.":"Importação de conversas com cobertura do histórico acompanhada por conexão."}</p>
        {provider.id==="nowz"&&provider.available===true&&session.workspace.role==="manager"&&<Button variant="secondary" size="sm" onClick={()=>setConnecting(true)}>Conectar Nowz</Button>}
      </section>)}
      {data.items.map((item,i)=><DetailRows key={item.connection_id} items={[
        {label:"Conexão "+(i+1),value:names[item.provider]||item.provider},
        {label:"Histórico",value:item.coverage?.historyComplete===true?"Cobertura confirmada pela integração":"Cobertura parcial ou ainda em conferência"},
        {label:"Envio",value:item.capabilities?.send===true?"Disponível conforme autorização da conta":"Somente importação"},
      ]} />)}
      {!data.items.length&&<DetailText>Nenhum sistema de atendimento conectado neste acesso.</DetailText>}
    </>}</ReadState>
    {notice&&<p role="status">{notice}</p>}
    {connecting&&<ConnectNowz context={context} close={()=>setConnecting(false)} saved={()=>{setConnecting(false);setNotice("Conexão conferida. A importação do histórico ocorrerá gradualmente.");read.retry();}} />}
  </DetailSection>;
}
