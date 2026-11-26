"use client";
import {ButtonLink,DataTable} from "@content-ventures/design-system/v3";
import {Trophy} from "lucide-react";
import {DetailPage,DetailText} from "../../src/ui/os/detail";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Page} from "../../lib/v2-client";
import {CursorNav,ReadState} from "./read-state";
import {exactReais} from "./work-queue";
import {CommercialScope,CoverageNotice,useViewScope} from "./commercial-view-scope";
import {orderHref} from "./commercial-report";
import css from "./commercial-views.module.css";
const creditNames={zoe:"Zoe",team:"Equipe",unknown:"Sem base suficiente"};
export function CommercialSales({route,context,session}){
  const scope=useViewScope(route),read=useV2Page("commercial/sales?"+scope.query,context);
  return <DetailPage title="Ganhos por negociação" icon={Trophy}>
    <div className={css.sections}><CommercialScope scope={scope} context={context} session={session} />
    <ReadState retain read={read}>{data=><>
      <StatTiles label="Ganhos de todo o período autorizado" items={[
        {id:"sales",label:"Vendas confirmadas",value:data.summary.sales},
        {id:"amount",label:"Valor conhecido",value:exactReais(data.summary.amountCents)},
        {id:"unknown",label:"Vendas sem valor informado",value:data.summary.salesWithoutAmount},
      ]} />
      <DetailText>Cada negociação confirmada conta uma venda. Um mesmo cliente pode aparecer mais de uma vez. Os totais abrangem todas as páginas.</DetailText>
      <CoverageNotice coverage={data.coverage} takenAt={data.takenAt} scope={data.scope} />
      {data.items.length?<div className={css.table}><DataTable label="Vendas confirmadas por pedido" density="compact" rows={data.items} rowKey={r=>r.opportunityId} columns={[
        {key:"contact",header:"Cliente e pedido",pinned:true,render:r=><ButtonLink variant="ghost" size="sm" href={orderHref(r.conversationId,r.opportunityId,scope.query)}>{r.title}{r.opportunityTitle?" · "+r.opportunityTitle:""}</ButtonLink>},
        {key:"line",header:"Linha",render:r=>r.lineName},
        {key:"amount",header:"Valor",numeric:true,render:r=>r.amountCents===null?"Valor não informado":exactReais(r.amountCents)},
        {key:"confirmed",header:"Confirmação",render:r=>r.confirmedAt?new Date(r.confirmedAt).toLocaleString("pt-BR",{timeZone:data.scope.timeZone}):"Sem confirmação registrada"},
        {key:"origin",header:"Origem",render:r=>r.origin==="manual"?"Registro manual":r.origin==="automatic"?"Identificada na análise":"Origem não informada"},
        {key:"credit",header:"Crédito",render:r=>r.credit?creditNames[r.credit.by]||creditNames.unknown:creditNames.unknown},
      ]} /></div>:<EmptyState size="compact" icon={Trophy} title="Sem vendas confirmadas neste período" description="Os ganhos confirmados das suas negociações aparecerão aqui." />}
    </>}</ReadState><CursorNav page={read} label="Páginas dos ganhos por pedido" />
    </div>
  </DetailPage>;
}
