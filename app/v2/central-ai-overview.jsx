"use client";
import {useState} from "react";
import {Button, Input, Select} from "@content-ventures/design-system/v3";
import {DetailRows, DetailSection, DetailText} from "../../src/ui/os/detail";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action, useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import {stageLabels} from "./central-ai-catalog";
import css from "./central-ai.module.css";

export const usd=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD",maximumFractionDigits:6}).format(Number(value)/1000000);
const usdNumber=value=>new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:6}).format(Number(value)/1000000);
function micros(value) {return /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(value)?String(BigInt(value.split(".")[0])*1000000n+BigInt((value.split(".")[1]||"").padEnd(6,"0"))):null;}
function BudgetEditor({item,settings,close,saved}) {
  const action=useV2Action(), [value,setValue]=useState(String(Number(item?.monthlyMicros||settings?.shadowMonthlyMicros||0)/1e6));
  const amount=micros(value), shadow=!item;
  return <ResponsiveDialog open title={shadow?"Orçamento de avaliação em sombra":"Orçamento de IA da empresa"} size="sm" onClose={close} dismissible={!action.pending}>
    <form className={css.form} onSubmit={event=>{
      event.preventDefault();if(amount===null)return;const reason=new FormData(event.currentTarget).get("reason").trim();
      if(shadow) action.run("staff/ai/catalog","POST",{kind:"shadowBudget",item:{monthlyMicros:amount,expectedVersion:settings.version},reason},saved);
      else action.run("staff/ai/budgets/"+item.workspaceId,"PUT",{monthlyMicros:amount,expectedMonthlyMicros:item.monthlyMicros,reason},saved);
    }}>
      <p>{shadow?"A sombra possui orçamento próprio, separado das empresas.":item.name}</p>
      <label>Limite mensal em USD<Input value={value} inputMode="decimal" required onChange={event=>setValue(event.target.value)} /></label>
      <label>Motivo<Input name="reason" minLength={3} maxLength={500} required /></label>
      <p>O limite não pode ficar abaixo das chamadas liquidadas e das reservas comprometidas.</p>
      {action.error&&<p role="alert">{action.error}</p>}
      <Button type="submit" disabled={action.pending || amount===null}>Salvar orçamento</Button>
    </form>
  </ResponsiveDialog>;
}
function Overview({data,canEdit,settings,reload,refreshCatalog}) {
  const [budget,setBudget]=useState(null), [reprocess,setReprocess]=useState(null), action=useV2Action();
  const [mode,setMode]=useState("provider_metered");
  const modes=[...new Set(data.calls.map(row=>row.mode||"unclassified"))], activeMode=modes.includes(mode)?mode:modes[0]||"unclassified";
  const labels={provider_metered:"Uso medido pelo fornecedor",local_simulated:"Simulação local",unclassified:"Modo sem identificação"};
  const calls=data.calls.filter(row=>(row.mode||"unclassified")===activeMode);
  const total=field=>calls.reduce((sum,row)=>sum+BigInt(row[field]),0n).toString();
  const saved=()=>{setBudget(null);reload();refreshCatalog();};
  return <>
    <DetailSection title="Custo e fila" meta="Mês atual em UTC" action={<Button variant="ghost" size="sm" onClick={reload}>Atualizar operação</Button>}>
      {modes.length>0&&<Select label="Modo de execução dos custos" value={activeMode} onChange={setMode} options={modes.map(value=>({value,label:labels[value]||value}))} />}
      <StatTiles label="Operação do motor" items={[
        {id:"settled",label:"Custo liquidado USD",value:usdNumber(total("settledMicros"))},
        {id:"held",label:"Reserva comprometida USD",value:usdNumber(total("reservedMicros"))},
        {id:"drafts",label:"Sugestões na fila",value:data.queue.drafts},
        {id:"diagnostics",label:"Diagnósticos em execução ou fila",value:data.queue.diagnostics},
      ]} />
      <DetailText>{activeMode==="local_simulated"?"Valores de simulação local, sem cobrança de fornecedor. Não são somados ao uso real.":
        activeMode==="unclassified"?"Registros sem identificação do modo ficam separados. Confira a origem antes de tratar os valores como cobrança.":
        "O custo usa o uso confirmado e a tarifa de cada tentativa. A reserva inclui chamadas sem confirmação. A fatura final é apurada pelo fornecedor."}</DetailText>
      {data.queue.oldestDraft&&<DetailText>Sugestão mais antiga na fila desde {new Date(data.queue.oldestDraft).toLocaleString("pt-BR")}.</DetailText>}
      {!data.calls.length&&<DetailText>Ainda não há chamadas neste ciclo.</DetailText>}
      {calls.map((row,i)=><details key={i}><summary>{stageLabels[row.stage]} · {row.provider}:{row.model} · {row.lane} · {row.state}</summary>
        <DetailRows items={[{label:"Tentativas",value:row.calls},{label:"Liquidado",value:usd(row.settledMicros)},
          {label:"Reservado",value:usd(row.reservedMicros)},{label:"Latência média",value:row.latencyMs===null?"Sem medição":row.latencyMs+" ms"}]} />
      </details>)}
    </DetailSection>
    <DetailSection title="Orçamentos" action={canEdit&&<Button size="sm" variant="secondary" onClick={()=>setBudget("shadow")}>Alterar orçamento da sombra</Button>}>
      <DetailText>Sombra por mês: {usd(settings.shadowMonthlyMicros)}. Os primeiros 200 orçamentos são listados por nome.</DetailText>
      {data.budgets.map(item=><section key={item.workspaceId} aria-label={item.name}>
        <DetailRows items={[{label:"Empresa",value:item.name},{label:"Limite mensal",value:item.monthlyMicros===null?"Sem configuração":usd(item.monthlyMicros)},
          {label:"Liquidado",value:usd(item.settledMicros)},{label:"Reservado",value:usd(item.reservedMicros)},
          ...(item.blockedReason?[{label:"Bloqueio",value:item.blockedReason}]:[])]} />
        {canEdit&&item.monthlyMicros!==null&&<Button variant="ghost" size="sm" onClick={()=>setBudget(item)}>Alterar orçamento de {item.name}</Button>}
      </section>)}
    </DetailSection>
    <DetailSection title="Últimas falhas" meta="Até 50 tentativas">
      {!data.failures.length&&<DetailText>Nenhuma falha registrada.</DetailText>}
      {data.failures.map(item=><DetailRows key={item.id} items={[
        {label:"Tentativa",value:item.id},{label:"Modelo e função",value:item.provider+":"+item.model+" · "+stageLabels[item.stage]},
        {label:"Estado",value:item.state+" · "+(item.error||"Sem detalhe")},
      ]} />)}
    </DetailSection>
    <DetailSection title="Reprocessamento elegível">
      <DetailText>Somente sugestões da revisão atual, sem chamada paga, incerta ou em execução. O servidor confere novamente antes de enfileirar.</DetailText>
      {!data.draftFailures.length&&<DetailText>Nenhuma sugestão elegível.</DetailText>}
      {data.draftFailures.map(item=><section key={item.workspaceId+item.conversationId+item.revision}>
        <DetailRows items={[{label:"Conversa",value:item.conversationId},{label:"Falha",value:item.reason||item.state}]} />
        {canEdit&&<Button size="sm" variant="secondary" onClick={()=>setReprocess(item)}>Reprocessar sugestão</Button>}
      </section>)}
    </DetailSection>
    {budget&&<BudgetEditor item={budget==="shadow"?null:budget} settings={settings} close={()=>setBudget(null)} saved={saved} />}
    {reprocess&&<ResponsiveDialog open title="Reprocessar sugestão elegível" size="sm" onClose={()=>setReprocess(null)} dismissible={!action.pending}>
      <form className={css.form} onSubmit={event=>{
        event.preventDefault();const {workspaceId,conversationId,revision}=reprocess;
        action.run("staff/ai/reprocess","POST",{workspaceId,conversationId,revision,reason:new FormData(event.currentTarget).get("reason").trim()},()=>{setReprocess(null);reload();});
      }}><label>Motivo<Input name="reason" minLength={3} maxLength={500} required /></label>
        {action.error&&<p role="alert">{action.error}</p>}<Button type="submit" disabled={action.pending}>Enfileirar sugestão</Button>
      </form>
    </ResponsiveDialog>}
  </>;
}
export function AiOverview({canEdit,settings,refreshCatalog}) {
  const read=useV2Read("staff/ai/overview");
  return <ReadState read={read}>{data=><Overview data={data} canEdit={canEdit} settings={settings} refreshCatalog={refreshCatalog} reload={read.retry} />}</ReadState>;
}
