"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Button,ButtonLink,DataTable,MeterList,ThemeV3} from "@content-ventures/design-system/v3";
import {ChartColumn,Monitor,Printer,RefreshCw} from "lucide-react";
import {DetailPage,DetailSection,DetailText} from "../../src/ui/os/detail";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Read} from "../../lib/v2-client";
import {filterNames,signalNames} from "../../lib/commercial-views";
import {ReadState} from "./read-state";
import {exactReais} from "./work-queue";
import {CommercialScope,CoverageNotice,useViewScope,viewHref} from "./commercial-view-scope";
import css from "./commercial-views.module.css";
import skin from "../../src/ui/os/os-theme.module.css";
const formatMetric=m=>m.value==null?"Sem medição":m.unit==="cents"?exactReais(String(m.value)):m.unit==="minutes"?m.value+" min":m.value;
const saleMetrics=new Set(["sales","salesWithoutAmount","amountCents"]);
const reportLink=(m,params)=>saleMetrics.has(m.id)?viewHref("resultados",params,{filter:null}):filterNames[m.filter]?viewHref("entrada",params,{filter:m.filter}):undefined;
export const orderHref=(conversationId,opportunityId,params)=>viewHref("conversa/"+conversationId+(opportunityId?"/pedido/"+opportunityId:""),params,{filter:null});
export function CommercialReportBody({data,params,company,tv=false}){
  const metrics=(data.metrics||[]).map(m=>({id:m.id,label:m.label,value:formatMetric(m),...(m.value==null?{}:{href:reportLink(m,params)})}));
  const temperatureBase=(data.temperatures||[]).reduce((sum,item)=>sum+item.count,0);
  return <div className={css.sections}>
    <header><h1>{tv?"Painel da operação":data.title}</h1><p>{company}</p><CoverageNotice coverage={data.coverage} takenAt={data.takenAt} scope={data.scope} /></header>
    <StatTiles label="Indicadores comerciais do período" columns={4} items={metrics} />
    <div className={css.grid}>
      <DetailSection title="Sinais de atendimento" meta="Quantidade e base informadas pela análise">
        <div className={css.table}><DataTable label="Sinais da operação" density="compact" rows={data.signals||[]} rowKey={r=>r.id} columns={[
          {key:"signal",header:"Sinal",pinned:true,render:r=>signalNames[r.signal]?<ButtonLink variant="ghost" size="sm" href={viewHref("entrada",params,{filter:"todas",signal:r.signal})}>{r.label}</ButtonLink>:filterNames[r.filter]?<ButtonLink variant="ghost" size="sm" href={viewHref("entrada",params,{filter:r.filter})}>{r.label}</ButtonLink>:r.label},
          {key:"count",header:"Conversas",numeric:true,render:r=>r.count},
          {key:"base",header:"Base avaliada",numeric:true,render:r=>r.base},
        ]} /></div>
      </DetailSection>
      <DetailSection title="Temperatura das conversas" meta="Leituras atuais no período">
        {(data.temperatures||[]).length?<MeterList label="Conversas por temperatura" items={data.temperatures.map(t=>({key:t.id,label:t.label,value:t.count,share:temperatureBase?100*t.count/temperatureBase:0,color:({quente:"red",morno:"amber",frio:"teal"})[t.id]||"gray"}))} format={String} shares={false} />:<DetailText>Sem classificação suficiente neste período.</DetailText>}
      </DetailSection>
    </div>
    {!tv&&<DetailSection title="Atividade e vendas registradas" meta="Pelo horário de cada evento">
      <div className={css.table}><DataTable label="Atividade e vendas por dia" density="compact" rows={data.series||[]} rowKey={r=>r.day} columns={[
        {key:"day",header:"Dia",pinned:true,render:r=>/^\d{4}-\d{2}-\d{2}$/.test(r.day)?r.day.split("-").reverse().join("/"):r.day},
        {key:"conversations",header:"Conversas",numeric:true,render:r=>r.conversations},
        {key:"sales",header:"Vendas",numeric:true,render:r=>r.sales},
        {key:"amount",header:"Valor conhecido",numeric:true,render:r=>exactReais(r.amountCents)},
      ]} /></div>
    </DetailSection>}
    {!tv&&<DetailSection title="Prioridades para atendimento" meta={Number.isInteger(data.priority?.total)?`${data.priority.items?.length||0} ${data.priority.items?.length===1?"exibida":"exibidas"} de ${data.priority.total} no conjunto autorizado`:"Conjunto autorizado"}>
      {data.priority?.items?.length?<div className={css.table}><DataTable label="Prioridades do relatório" rows={data.priority.items} rowKey={r=>r.opportunityId||r.id} density="compact" columns={[
        {key:"contact",header:"Conversa",pinned:true,render:r=><ButtonLink variant="ghost" size="sm" href={orderHref(r.id,r.opportunityId,params)}>{r.title}</ButtonLink>},
        {key:"summary",header:"O que tratar",render:r=>r.summary},
      ]} /></div>:<EmptyState size="compact" icon={ChartColumn} title="Sem prioridades neste período" description="As conversas que precisam de atenção aparecerão aqui conforme as análises." />}
    </DetailSection>}
    {tv&&<DetailText>Acompanhe a operação pelos indicadores autorizados desta conta. O painel é atualizado a cada 30 segundos enquanto estiver visível.</DetailText>}
  </div>;
}
export function CommercialReport({route,context,session,tv=false,dashboard=false}){
  const scope=useViewScope(route),read=useV2Read("commercial/report?"+scope.query,context),screen=useRef(null),[notice,setNotice]=useState(""),[printHost,setPrintHost]=useState(null);
  useEffect(()=>{setPrintHost(document.body);},[]);
  useEffect(()=>{
    if(tv)return;
    const start=()=>{document.body.dataset.commercialPrint="1";document.documentElement.dataset.commercialPrint="1";},stop=()=>{delete document.body.dataset.commercialPrint;delete document.documentElement.dataset.commercialPrint;};
    window.addEventListener("beforeprint",start);window.addEventListener("afterprint",stop);
    return()=>{window.removeEventListener("beforeprint",start);window.removeEventListener("afterprint",stop);stop();};
  },[tv]);
  useEffect(()=>{
    if(!tv)return;const refresh=()=>{if(document.visibilityState==="visible")read.retry();};
    const timer=setInterval(refresh,30000);document.addEventListener("visibilitychange",refresh);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[tv,context,String(scope.query)]);
  const controls=<div className={css.noPrint}><CommercialScope scope={scope} context={context} session={session} />
    <div className={css.actions}>
      <Button size="sm" variant="secondary" icon={RefreshCw} disabled={read.loading} onClick={read.retry}>Atualizar relatório</Button>
      {!tv&&<Button size="sm" variant="secondary" icon={Printer} disabled={!read.data||read.loading||!!read.error} onClick={()=>window.print()}>Imprimir ou salvar PDF</Button>}
      {!tv&&<ButtonLink size="sm" variant="ghost" icon={Monitor} href={viewHref("tv",scope.query)}>Abrir TV</ButtonLink>}
      {dashboard&&<ButtonLink size="sm" variant="ghost" href={viewHref("raio-x",scope.query)}>Abrir Raio-X</ButtonLink>}
      {tv&&<><Button size="sm" variant="secondary" onClick={async()=>{try{if(!screen.current?.requestFullscreen)throw Error();await screen.current.requestFullscreen();}catch{setNotice("Tela cheia indisponível neste navegador. O painel continua atualizado nesta página.");}}}>Entrar em tela cheia</Button><ButtonLink size="sm" variant="ghost" href={viewHref("raio-x",scope.query)}>Abrir Raio-X</ButtonLink></>}
    </div>{notice&&<p role="status">{notice}</p>}
  </div>;
  const body=<>{controls}<ReadState full read={read}>{data=><article className={tv?undefined:css.printRoot} aria-label={tv?"TV da operação":"Raio-X comercial autorizado"}>
    <CommercialReportBody data={data} params={scope.query} company={session.workspace.name} tv={tv} />
  </article>}</ReadState></>;
  return tv?<section ref={screen} className={css.tv} aria-label="TV da operação">{body}</section>:<>
    <DetailPage title={dashboard?"Panorama comercial":"Raio-X comercial"} icon={ChartColumn}>{body}</DetailPage>
    {printHost&&read.data&&!read.error&&createPortal(<div className={css.printCopy} data-commercial-print-root aria-hidden="true" inert>
      <ThemeV3 className={skin.brand} mode="light"><CommercialReportBody data={read.data} params={scope.query} company={session.workspace.name} /></ThemeV3>
    </div>,printHost)}
  </>;
}
