"use client";
import {useState} from "react";
import {Button, Input, Select} from "@content-ventures/design-system/v3";
import {DetailRows, DetailSection, DetailText} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action, useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import {currentPrice,stageLabels} from "./central-ai-catalog";
import css from "./central-ai.module.css";

function RouteEditor({stage,data,catalog,reload}) {
  const current=data.current, action=useV2Action();
  const editing=catalog.canEdit&&catalog.executionEnabled===true;
  const [reserve,setReserve]=useState(current.reserve || ""), [shadow,setShadow]=useState(current.shadow || "");
  const [percent,setPercent]=useState(current.shadowPercent), [timeout,setTimeoutValue]=useState(current.timeoutMs/1000);
  const [reason,setReason]=useState(""), [promote,setPromote]=useState(false), [message,setMessage]=useState("");
  const allowed=catalog.models.filter(m=>m.enabled && m.stages.includes(stage) && catalog.providers.some(p=>p.id===m.provider && p.enabled));
  const choices=lane=>[{value:"",label:lane==="shadow"?"Sem avaliação em sombra":"Sem reserva"},...allowed.filter(m=>lane==="shadow"||!m.shadowOnly).map(m=>{
    const name=m.provider+":"+m.model, price=currentPrice(catalog,name);
    return {value:name,label:m.label+" · "+name,disabled:!price?.verifiedAt || name===current.principal,
      description:!price?.verifiedAt?"Tarifa pendente de verificação":m.shadowOnly?"Somente sombra":undefined};
  })];
  const body=(actionName,extra={})=>({action:actionName,expectedVersion:current.version,reason:reason.trim(),...extra});
  const saved=()=>{setPromote(false);setMessage("Rota salva. Novas execuções usarão a configuração atualizada.");reload();};
  return <>
    <DetailSection title={stageLabels[stage]} meta={current.version?"Versão "+current.version:"Rota padrão herdada"}>
      <DetailRows items={[{label:"Modelo principal",value:current.principal},{label:"Reserva atual",value:current.reserve || "Nenhuma"}]} />
      {data.problem && <p role="status">Execução bloqueada pelo catálogo: {data.problem}.</p>}
      {!catalog.executionEnabled&&<DetailText>A execução por catálogo está desligada. Cadastre e verifique as tarifas na Biblioteca; a implantação ativa a execução antes da alteração de rotas.</DetailText>}
      <DetailText>A sombra compara respostas sem substituir a principal. Seu custo tem um orçamento separado.</DetailText>
      <form className={css.form} onSubmit={event=>{
        event.preventDefault();setMessage("");
        action.run("staff/ai/routes/"+stage,"POST",body("set",{route:{reserve:reserve || null,shadow:shadow || null,shadowPercent:Number(percent),timeoutMs:Number(timeout)*1000}}),saved);
      }}>
        <Select label="Modelo de reserva" searchable value={reserve} onChange={setReserve} disabled={!editing || action.pending} options={choices("reserve")} />
        <Select label="Modelo em sombra" searchable value={shadow} onChange={setShadow} disabled={!editing || action.pending} options={choices("shadow")} />
        <label>Percentual de sombra<Input type="number" min="0" max="100" step="1" required value={percent} disabled={!editing} onChange={event=>setPercent(event.target.value)} /></label>
        <label>Prazo máximo em segundos<Input type="number" min="1" max="300" required value={timeout} disabled={!editing} onChange={event=>setTimeoutValue(event.target.value)} /></label>
        {catalog.canEdit&&<><label>Motivo e avaliação de prazo e custo<Input required minLength={3} maxLength={500} value={reason} disabled={!editing} onChange={event=>setReason(event.target.value)} /></label>
          <div className={css.actions}>
            <Button type="submit" disabled={!editing || action.pending}>Salvar reserva e sombra</Button>
            <Button type="button" variant="secondary" disabled={!editing || action.pending || !current.shadow || reason.trim().length<3} onClick={()=>setPromote(true)}>Promover modelo avaliado</Button>
            <Button type="button" variant="ghost" disabled={!editing || action.pending || current.version===null || reason.trim().length<3}
              onClick={()=>action.run("staff/ai/routes/"+stage,"POST",body("rollback"),saved)}>Reverter última mudança</Button>
          </div></>}
      </form>
      {message&&<p role="status">{message}</p>}
      {action.error&&<div role="alert"><p>{action.error}</p><Button size="sm" variant="ghost" onClick={reload}>Reler configuração</Button></div>}
    </DetailSection>
    {data.evaluation&&<DetailSection title="Evidências da avaliação em sombra">
      <DetailRows items={[{label:"Modelo avaliado",value:current.shadow},{label:"Chamadas comparadas nos últimos 30 dias",value:data.evaluation.calls},
        ...Object.entries(data.evaluation.agreement).map(([field,value])=>({label:field,value:value===null?"Sem comparação":(value*100).toFixed(2)+"%"}))]} />
      {data.evaluation.missing.map((text,i)=><DetailText key={i}>{text}</DetailText>)}
      <DetailText>A promoção também exige um conjunto rotulado por pessoas. Ausência de comparação crítica bloqueia a troca.</DetailText>
    </DetailSection>}
    <DetailSection title="Histórico de rotas">
      {!data.history.length&&<DetailText>Nenhuma alteração registrada.</DetailText>}
      {data.history.map(row=><details key={row.version}><summary>{"Versão "+row.version+" · "+row.kind+" · "+new Date(row.at).toLocaleString("pt-BR")}</summary>
        <DetailRows items={[{label:"Principal",value:row.principal},{label:"Autor",value:row.author},{label:"Motivo",value:row.reason}]} />
      </details>)}
    </DetailSection>
    {promote&&<ResponsiveDialog open title="Promover modelo avaliado" size="sm" onClose={()=>setPromote(false)} dismissible={!action.pending}>
      <form className={css.form} onSubmit={event=>{
        event.preventDefault();const form=new FormData(event.currentTarget);
        action.run("staff/ai/routes/"+stage,"POST",body("promote",{route:{principal:current.shadow},bench:{
          conversations:Number(form.get("conversations")),principalCorrect:Number(form.get("principalCorrect")),candidateCorrect:Number(form.get("candidateCorrect")),
        }}),saved);
      }}>
        <p>{current.shadow} passará a ser principal, se cumprir todos os critérios. A principal atual ficará como reserva.</p>
        <label>Conversas rotuladas por pessoas<Input name="conversations" type="number" min="60" step="1" required /></label>
        <label>Acertos da principal<Input name="principalCorrect" type="number" min="0" step="1" required /></label>
        <label>Acertos do candidato<Input name="candidateCorrect" type="number" min="0" step="1" required /></label>
        {action.error&&<p role="alert">{action.error}</p>}
        <Button type="submit" disabled={action.pending}>Validar e promover</Button>
      </form>
    </ResponsiveDialog>}
  </>;
}
export function AiRoutes({catalog}) {
  const [stage,setStage]=useState("draft");
  const route=useV2Read("staff/ai/routes/"+stage);
  return <>
    <Select label="Função do motor" value={stage} onChange={setStage} options={catalog.stages.map(value=>({value,label:stageLabels[value]}))} />
    <ReadState read={route}>{data=><RouteEditor key={stage+"/"+data.current.version} stage={stage} data={data} catalog={catalog} reload={route.retry} />}</ReadState>
  </>;
}
