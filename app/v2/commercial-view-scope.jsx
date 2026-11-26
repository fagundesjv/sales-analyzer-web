"use client";
import {useEffect,useMemo,useState} from "react";
import {Button,Input,Select} from "@content-ventures/design-system/v3";
import {useV2Read} from "../../lib/v2-client";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import css from "./commercial-views.module.css";
export const viewQuery=route=>new URLSearchParams(route.split("?")[1]||"");
export function useViewScope(route){
  const params=useMemo(()=>viewQuery(route),[route]);
  const query=new URLSearchParams();
  query.set("windowDays",params.get("windowDays")||"7");
  for(const name of ["connectionId","ownerId"])if(params.get(name))query.set(name,params.get(name));
  const change=patch=>{const current=window.location.hash.slice(1)||route,next=viewQuery(current);for(const [key,value]of Object.entries(patch)){if(value==null||value===""||value===false)next.delete(key);else next.set(key,String(value));}next.delete("cursor");window.location.hash=current.split("?")[0]+(next.size?"?"+next:"");};
  return {params,query,change};
}
export function viewHref(path,params,patch={}){
  const next=new URLSearchParams(params);next.delete("cursor");next.delete("q");next.delete("favorite");
  for(const [name,value]of Object.entries(patch))value==null?next.delete(name):next.set(name,String(value));
  return "#"+path+(next.size?"?"+next:"");
}
export function CommercialScope({scope,context,session}){
  const lines=useV2Read("connections?limit=100",context),team=useV2Read(session.workspace.role==="manager"?"team?limit=100":null,context);
  const presets=[1,7,15,30,60,90],days=Number(scope.params.get("windowDays")||7);
  const [custom,setCustom]=useState(!presets.includes(days)),[draft,setDraft]=useState(String(days));
  useEffect(()=>{setCustom(!presets.includes(days));setDraft(String(days));},[days]);
  return <div className={css.filters} aria-label="Escopo dos dados comerciais">
    <Select label="Período do relatório" value={custom?"custom":String(days)} onChange={value=>{setCustom(value==="custom");if(value!=="custom")scope.change({windowDays:value});else setDraft(String(days));}}
      options={[...presets.map(d=>({value:String(d),label:d===1?"Último dia":`Últimos ${d} dias`})),{value:"custom",label:"Período personalizado"}]} />
    {custom&&<form className={css.period} onSubmit={event=>{event.preventDefault();scope.change({windowDays:draft});}}><label>Dias do relatório<Input name="days" type="number" inputMode="numeric" min={1} max={90} required value={draft} onChange={event=>setDraft(event.target.value)} /></label><Button type="submit" size="sm">Aplicar período</Button></form>}
    <Select label="Linha de atendimento" value={scope.params.get("connectionId")||""} onChange={id=>scope.change({connectionId:id})} disabled={lines.loading}
      options={[{value:"",label:"Todas as linhas autorizadas"},...(lines.data?.items||[]).map(l=>({value:l.id,label:l.name}))]} />
    {session.workspace.role==="manager"&&<Select label="Responsável pela linha" value={scope.params.get("ownerId")||""} onChange={id=>scope.change({ownerId:id})} disabled={team.loading}
      options={[{value:"",label:"Todos os responsáveis"},...(team.data?.items||[]).map(p=>({value:p.id,label:p.name}))]} />}
    {(lines.error||team.error)&&<p role="status">Algumas opções de escopo não estão disponíveis. <Button variant="ghost" size="sm" onClick={()=>{lines.retry();team.retry();}}>Conferir opções</Button></p>}
  </div>;
}
const reasonNames={unread:"Há conversas que ainda não foram analisadas.",unavailable_readings:"Há conversas que ainda não têm leitura disponível.",stale:"Há leituras aguardando atualização.",stale_readings:"Há leituras aguardando atualização.",missing_sources:"Parte das fontes não está disponível.",missingSources:"Parte das fontes não está disponível.",partial_source:"O histórico de algumas fontes está incompleto.",universe_capped:"O recorte está limitado a 5.000 conversas autorizadas.",text_search_capped:"A busca no texto considera até 2.000 conversas. Use nome ou telefone, ou reduza o período para refinar.",history_limited:"O histórico de parte das conversas está incompleto. Contatos novos refletem o início observado no material disponível.",handoff_scope_incomplete:"Há encaminhamentos para atendimentos fora deste escopo. A continuidade não pode ser confirmada por esta conta."};
export function CoverageNotice({coverage,takenAt,scope,compact=false}){
  const [open,setOpen]=useState(false);
  if(!coverage&&!takenAt&&!scope)return null;
  const at=new Date(takenAt),from=new Date(scope?.from),through=new Date(scope?.through);
  if(compact)return <div className={css.coverage} role="status">
    {coverage?.state==='partial'&&<strong>Leitura parcial</strong>}
    <p>{scope?.windowDays===1?'Último dia':`Últimos ${scope?.windowDays} dias`}{Number.isFinite(at.getTime())?` · Atualizado ${at.toLocaleString('pt-BR',{timeZone:scope?.timeZone||'UTC'})}`:''}</p>
    <Button size="sm" variant="ghost" onClick={()=>setOpen(true)}>Conferir cobertura do recorte</Button>
    {open&&<ResponsiveDialog open title="Cobertura do recorte" onClose={()=>setOpen(false)}><CoverageNotice coverage={coverage} takenAt={takenAt} scope={scope} /><Button onClick={()=>setOpen(false)}>Voltar às conversas</Button></ResponsiveDialog>}
  </div>;
  return <div className={css.coverage} role="status">
    {coverage?.state==="partial"&&<><strong>Leitura parcial</strong><p>{[...new Set((coverage.reasons||[]).map(reason=>reasonNames[reason]||"Parte dos dados ainda precisa ser conferida."))].join(" ")}</p>
      <p>{coverage.unread} sem leitura · {coverage.stale} aguardando atualização · {coverage.missingSources} com fonte indisponível</p></>}
    {Number.isFinite(at.getTime())&&<p>Atualizado em {at.toLocaleString("pt-BR",{timeZone:scope?.timeZone||"UTC"})} · {scope?.timeZone||"UTC"}</p>}
    {Number.isFinite(from.getTime())&&Number.isFinite(through.getTime())&&<p>Período de {from.toLocaleString("pt-BR",{timeZone:scope?.timeZone||"UTC"})} a {through.toLocaleString("pt-BR",{timeZone:scope?.timeZone||"UTC"})}</p>}
  </div>;
}
