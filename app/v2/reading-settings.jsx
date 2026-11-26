"use client";
import {useState} from "react";
import {Button,Input,Select} from "@content-ventures/design-system/v3";
import {DetailRows,DetailSection,DetailText} from "../../src/ui/os/detail";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import css from "./central-ai.module.css";

const pace=minutes=>minutes<60?minutes+" minutos":minutes===1440?"1 dia":minutes/60+" horas";
const reasons={trial_limit:"Limite disponível no período de teste",account_size:"Volume de conversas da empresa",server_capacity:"Capacidade de processamento",off_hours:"Fora do expediente da empresa"};
function ReadingEditor({value,context,saved,reload}) {
  const [cadence,setCadence]=useState(String(value.cadenceMinutes)),[window,setWindow]=useState(String(value.windowDays));
  const [custom,setCustom]=useState(String(value.windowDays));
  const windowDays=window==="custom"?Number(custom):Number(window), validWindow=Number.isInteger(windowDays)&&windowDays>=1&&windowDays<=90;
  const action=useV2Action(context),conflict=action.errorCode==="reading_settings_conflict";
  return <form className={css.form} onSubmit={event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    if(validWindow)action.run("reading-settings","PUT",{version:value.version,cadenceMinutes:Number(cadence),dailyTime:form.get("dailyTime")||value.dailyTime,windowDays},saved);
  }}>
    <Select label="A cada quanto tempo analisar" value={cadence} onChange={setCadence} options={value.cadences.map(item=>({value:String(item.minutes),label:"A cada "+pace(item.minutes),description:item.allowed?undefined:"Em vigor a cada "+pace(item.readsAs)}))} />
    <Select label="Conversas de qual período" value={window} onChange={setWindow} options={[...value.windows.map(item=>({value:String(item.days),label:item.days===1?"Último dia":"Últimos "+item.days+" dias"})),{value:"custom",label:"Escolher quantidade de dias"}]} />
    {window==="custom"&&<label>Quantidade de dias da análise<Input type="number" min="1" max="90" step="1" required value={custom} onChange={event=>setCustom(event.target.value)} /></label>}
    {Number(cadence)===1440&&<label>Horário diário da análise<Input name="dailyTime" type="time" required defaultValue={value.dailyTime} /></label>}
    {action.error&&<div role="alert"><p>{action.error}</p>{conflict&&<Button type="button" variant="ghost" onClick={reload}>Reler periodicidade</Button>}</div>}
    <Button type="submit" disabled={action.pending||conflict||!validWindow}>Salvar periodicidade e período</Button>
  </form>;
}
export function ReadingSettings({session,context}) {
  const read=useV2Read("reading-settings",context),[saved,setSaved]=useState(null);
  if(read.error?.status===404)return null;
  return <DetailSection title="Periodicidade e período de análise">
    <ReadState read={read}>{data=>{
      const value=saved||data;
      return <><DetailRows items={[{label:"Frequência escolhida",value:"A cada "+pace(value.cadenceMinutes)},
        {label:"Frequência em vigor",value:"A cada "+pace(value.effective.cadenceMinutes)},
        {label:"Período em vigor",value:value.effective.windowDays===1?"Último dia":"Últimos "+value.effective.windowDays+" dias"},
        ...(value.effective.reason?[{label:"Ajuste de frequência",value:reasons[value.effective.reason]||value.effective.reason}]:[]),
        {label:"Cobertura",value:value.coverage.read+" de "+value.coverage.total+" conversas"}]} />
        {session.workspace.role==="manager"&&<ReadingEditor key={value.version} value={value} context={context} saved={setSaved} reload={()=>{setSaved(null);read.retry();}} />}
        {saved&&<p role="status">Periodicidade e período salvos.</p>}
        <DetailText>A janela define o período consultado. A Zoe reaproveita leituras vigentes e processa mudanças e pendências elegíveis, sem reler todas as mensagens a cada passagem.</DetailText>
        {value.estimate?.measured===false&&<DetailText>Estimativas de leitura ainda não são medições de cobrança.</DetailText>}
      </>;
    }}</ReadState>
  </DetailSection>;
}
