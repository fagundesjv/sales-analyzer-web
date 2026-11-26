"use client";
import {useEffect,useState} from "react";
import {Button,SearchField} from "@content-ventures/design-system/v3";
import {DetailSection,DetailText} from "../../src/ui/os/detail";
import {Pills} from "../../src/ui/os/pills";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import {MemoryEditor,MemorySource,scopeNames} from "./memory-source";
import css from "./central-ai.module.css";

export function MemoryContext({context,session,conversationId,opportunityId}) {
  const [scope,setScope]=useState(conversationId?"customer":"company"),[search,setSearch]=useState(""),[query,setQuery]=useState("");
  const [selected,setSelected]=useState(null),[creating,setCreating]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),250);return()=>clearTimeout(timer);},[search]);
  const params=new URLSearchParams({scope,q:query,limit:"20"});
  if(conversationId)params.set("conversationId",conversationId);
  if(opportunityId)params.set("opportunityId",opportunityId);
  const read=useV2Read("memory/search?"+params,context,revision);
  const allowed=conversationId?["company","customer",...(opportunityId?["opportunity"]:[]),"private"]:["company","private"];
  const canCreate=session&&(scope==="private"||scope==="company"&&session.workspace.role==="manager");
  const reload=()=>setRevision(n=>n+1);
  if(read.error?.status===404)return null;
  return <DetailSection title={conversationId?"Memória deste relacionamento":"Base de conhecimento da Zoe"}
    action={canCreate&&<Button size="sm" onClick={()=>setCreating(true)}>{scope==="private"?"Adicionar nota privada":"Adicionar conhecimento da empresa"}</Button>}>
    <Pills label="Silos da memória" value={scope} onChange={value=>{setScope(value);setSelected(null);setSearch("");setQuery("");}} items={allowed.map(value=>({value,label:scopeNames[value]}))} />
    <DetailText>{scope==="company"?"Regras e conhecimentos da empresa, compartilhados conforme as permissões da equipe.":scope==="private"?"Notas acessíveis somente pela sua conta.":scope==="customer"?"Contexto deste cliente ao longo do relacionamento. Compras anteriores ajudam a entender o cliente.":"Contexto da negociação selecionada. Outras compras não viram novos ganhos ou retornos deste pedido."}</DetailText>
    <SearchField label="Buscar na memória autorizada" placeholder="Buscar conhecimento…" value={search} maxLength={200} onValueChange={setSearch} />
    <ReadState read={read}>{data=><div className={css.list}>
      {data.sources.length?data.sources.map(source=><section key={source.id+"/"+source.version} aria-label={source.title}>
        <h4>{source.title}</h4><p>{source.text.length>300?source.text.slice(0,300)+"…":source.text||"Fonte sem texto disponível"}</p>
        <Button size="sm" variant="secondary" onClick={()=>setSelected(source)}>Abrir fonte completa</Button>
      </section>):<p>Nenhuma fonte disponível neste silo para a busca atual.</p>}
      {data.sources.length===20&&<DetailText>Até 20 fontes por busca. Use palavras mais específicas para encontrar outros materiais.</DetailText>}
    </div>}</ReadState>
    {selected&&<MemorySource key={selected.id} sourceId={selected.id} context={context} session={session} close={()=>setSelected(null)} changed={reload} />}
    {creating&&<ResponsiveDialog open size="md" title={scope==="private"?"Nova nota privada":"Conhecimento da empresa"} onClose={()=>setCreating(false)}>
      <MemoryEditor scope={scope} context={context} close={()=>setCreating(false)} saved={source=>{setCreating(false);setSelected(source);reload();}} />
    </ResponsiveDialog>}
  </DetailSection>;
}
