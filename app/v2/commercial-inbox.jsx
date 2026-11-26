"use client";
import {useEffect,useRef,useState} from "react";
import {Button,Checkbox,SearchField,Select} from "@content-ventures/design-system/v3";
import {commercialFilters,filterNames,signalNames} from "../../lib/commercial-views";
import {inboxHref} from "../../lib/inbox";
import {ConnectedInbox} from "./inbox";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {CommercialScope,CoverageNotice,useViewScope} from "./commercial-view-scope";
import css from "./commercial-views.module.css";
export function CommercialInbox({route,...props}){
  const scope=useViewScope(route),q=scope.params.get("q")||"",filter=scope.params.get("filter")||"todas";
  const [search,setSearch]=useState(q),[advanced,setAdvanced]=useState(false),lastQuery=useRef(q);
  useEffect(()=>{if(q!==lastQuery.current){lastQuery.current=q;setSearch(q);}},[q]);
  useEffect(()=>{if(search.trim()===q)return;const timer=setTimeout(()=>{lastQuery.current=search.trim();scope.change({q:search.trim()});},230);return()=>clearTimeout(timer);},[search,q,route]);
  const params=new URLSearchParams(scope.query);params.set("filter",filter);if(q)params.set("q",q);if(scope.params.get("favorite")==="true")params.set("favorite","true");
  for(const name of ["order","signal"])if(scope.params.get(name))params.set(name,scope.params.get(name));
  const href=id=>inboxHref(id)+"?"+params;
  const view={path:"commercial/inbox?"+params,pending:search.trim()!==q,filtered:filter!=="todas"||!!q||scope.params.get("favorite")==="true",href,
    clear:()=>{lastQuery.current="";setSearch("");scope.change({filter:null,q:null,favorite:null,signal:null,order:null});},
    tools:read=><div className={css.inboxTools}>
      <SearchField label="Buscar conversas" placeholder="Nome, telefone ou mensagem…" value={search} maxLength={80} onValueChange={setSearch} />
      <Select label="Recorte das conversas" value={filter} onChange={value=>scope.change({filter:value,order:null})} searchable
        options={commercialFilters.map(f=>({value:f.id,label:f.name+(Number.isInteger(read.data?.counts?.[f.id])?` (${read.data.counts[f.id]})`:"")}))} />
      <Checkbox label="Somente favoritas" checked={scope.params.get("favorite")==="true"} onChange={event=>scope.change({favorite:event.target.checked?"true":null})} />
      {scope.params.get("signal")&&<div><p>Sinal de atendimento · {signalNames[scope.params.get("signal")]||"Recorte específico"}</p><Button size="sm" variant="ghost" onClick={()=>scope.change({signal:null})}>Remover sinal de atendimento</Button></div>}
      <Button variant="secondary" size="sm" onClick={()=>setAdvanced(true)}>Período, linhas e responsáveis</Button>
      {read.data&&<><p role="status">{Number.isInteger(read.data.counts?.[filter])?`${read.data.counts[filter]} ${filterNames[filter]?.toLocaleLowerCase("pt-BR")||"conversas neste recorte"} no período.`:"Contagem indisponível."} Os totais abrangem todas as páginas.</p>
        <CoverageNotice compact coverage={read.data.coverage} takenAt={read.data.takenAt} scope={read.data.scope} /></>}
    </div>};
  return <><ConnectedInbox {...props} commercialView={view} />
    {advanced&&<ResponsiveDialog open title="Escopo das conversas" onClose={()=>setAdvanced(false)}>
      <div className={css.sections}><CommercialScope scope={scope} context={props.context} session={props.session} />
        <Select label="Ordenar conversas" value={scope.params.get("order")||commercialFilters.find(f=>f.id===filter)?.order||"recentes"} onChange={value=>scope.change({order:value})} options={[
          {value:"recentes",label:"Atividade mais recente"},{value:"urgencia",label:"Urgência"},{value:"valor_em_risco",label:"Maior valor em risco"},{value:"valor_venda",label:"Maior valor de venda"},
        ]} /><Button onClick={()=>setAdvanced(false)}>Ver conversas</Button>
      </div>
    </ResponsiveDialog>}
  </>;
}
