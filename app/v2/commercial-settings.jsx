"use client";
import {useState} from "react";
import {Button,Checkbox,Input,Select,SwitchRow} from "@content-ventures/design-system/v3";
import {DetailRows,DetailSection,DetailText} from "../../src/ui/os/detail";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import css from "./central-ai.module.css";

const days=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const zones=["America/Sao_Paulo","America/Manaus","America/Rio_Branco","America/Noronha","UTC",...(Intl.supportedValuesOf?.("timeZone")||[])];
function PolicyEditor({initial,path,context,saved,reload}) {
  const action=useV2Action(context),[enabled,setEnabled]=useState(initial.enabled),[categories,setCategories]=useState(initial.categories);
  const [timezone,setTimezone]=useState(initial.timezone),[weekdays,setWeekdays]=useState(initial.weekdays),[consent,setConsent]=useState(false);
  const conflict=action.errorCode==="commercial_settings_conflict";
  const needConsent=enabled&&!initial.enabled;
  return <form className={css.form} onSubmit={event=>{
    event.preventDefault();if(conflict||needConsent&&!consent)return;const form=new FormData(event.currentTarget);
    action.run(path,"PUT",{version:initial.version,enabled,categories,timezone,weekdays,startTime:form.get("startTime"),endTime:form.get("endTime"),dailyLimit:Number(form.get("dailyLimit")),minGapMinutes:Number(form.get("minGapMinutes"))},saved);
  }}>
    <SwitchRow label="Envio automático da Zoe nesta linha" description="Configuração da sua conta. As mensagens podem ser enviadas sem abrir o atendimento." checked={enabled} onCheckedChange={setEnabled} disabled={action.pending} />
    <fieldset><legend>Mensagens permitidas</legend><div className={css.choices}>{[["reply","Respostas sugeridas"],["followup","Follow-ups"]].map(([value,label])=><Checkbox key={value} label={label} checked={categories.includes(value)} onChange={event=>setCategories(old=>event.target.checked?[...old,value]:old.filter(x=>x!==value))} />)}</div></fieldset>
    <Select label="Fuso dos envios automáticos" value={timezone} onChange={setTimezone} searchable options={[...new Set([initial.timezone,...zones])].map(value=>({value,label:value}))} />
    <label>Início dos envios<Input type="time" name="startTime" required defaultValue={initial.startTime} /></label>
    <label>Fim dos envios<Input type="time" name="endTime" required defaultValue={initial.endTime} /></label>
    <fieldset><legend>Dias de envio</legend><div className={css.choices}>{days.map((label,value)=><Checkbox key={value} label={label} checked={weekdays.includes(value)} onChange={event=>setWeekdays(old=>event.target.checked?[...old,value]:old.filter(x=>x!==value))} />)}</div></fieldset>
    <label>Máximo de mensagens por dia<Input name="dailyLimit" type="number" required min="1" max="100" defaultValue={initial.dailyLimit} /></label>
    <label>Intervalo mínimo entre envios em minutos<Input name="minGapMinutes" type="number" required min="5" max="1440" defaultValue={initial.minGapMinutes} /></label>
    {needConsent&&<Checkbox label="Autorizo a Zoe a enviar automaticamente nas condições acima" checked={consent} onChange={event=>setConsent(event.target.checked)} />}
    <DetailText>Revisões, permissões e a situação do pedido são conferidas antes de cada envio. Entrega incerta exige conferência e não gera reenvio automático.</DetailText>
    {action.error&&<div role="alert"><p>{action.error}</p>{conflict&&<Button type="button" variant="ghost" onClick={reload}>Reler consentimento</Button>}</div>}
    <Button type="submit" disabled={action.pending||conflict||!categories.length||!weekdays.length||needConsent&&!consent}>{action.pending?"Salvando…":enabled?initial.enabled?"Salvar condições dos envios":"Ativar envio automático":"Salvar envio automático desligado"}</Button>
  </form>;
}
export function AutomationPolicy({connectionId,context}) {
  const path="automation/policies/"+connectionId, read=useV2Read(path,context),[saved,setSaved]=useState(null);
  if(read.error?.status===404)return null;
  return <DetailSection title="Envio automático da sua conta">
    <ReadState read={read}>{data=>{
      const value=saved||data;
      return <><p role="status">{value.enabled?"Ativado por você nesta linha":"Desligado. A Zoe só envia automaticamente após sua autorização."}</p>
        <PolicyEditor key={value.version} initial={value} path={path} context={context} saved={setSaved} reload={()=>{setSaved(null);read.retry();}} />
        {saved&&<p role="status">Consentimento e condições salvos.</p>}</>;
    }}</ReadState>
  </DetailSection>;
}
function TouchEditor({initial,context,saved,reload}) {
  const action=useV2Action(context),[values,setValues]=useState(initial.touchDelaysMinutes.map(String));
  const valid=values.length>0&&values.every((v,i)=>/^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=129600&&(!i||Number(v)>Number(values[i-1])));
  return <form className={css.form} onSubmit={event=>{event.preventDefault();if(valid)action.run("commercial/settings","PUT",{version:initial.version,touchDelaysMinutes:values.map(Number)},saved);}}>
    <DetailText>Defina de um a seis toques. Cada prazo conta em minutos a partir da referência do follow-up e deve ser maior que o anterior.</DetailText>
    {values.map((value,index)=><label key={index}>{"Prazo do toque "+(index+1)+" em minutos"}<Input type="number" min="1" max="129600" required value={value} onChange={event=>setValues(old=>old.map((v,i)=>i===index?event.target.value:v))} /></label>)}
    <div className={css.actions}><Button type="button" variant="ghost" size="sm" disabled={values.length>=6} onClick={()=>setValues(old=>[...old,String(Number(old.at(-1)||0)+1440)])}>Adicionar toque</Button>
      <Button type="button" variant="ghost" size="sm" disabled={values.length<=1} onClick={()=>setValues(old=>old.slice(0,-1))}>Remover último toque</Button></div>
    {action.error&&<div role="alert"><p>{action.error}</p><Button type="button" variant="ghost" onClick={reload}>Reler cadência</Button></div>}
    <Button type="submit" disabled={action.pending||!valid||action.errorCode==="commercial_settings_conflict"}>Salvar cadência de follow-ups</Button>
  </form>;
}
export function CommercialSettings({session,context}) {
  const read=useV2Read("commercial/settings",context),[saved,setSaved]=useState(null);
  if(read.error?.status===404)return null;
  return <DetailSection title="Cadência de follow-ups da Zoe">
    <ReadState read={read}>{data=>{
      const value=saved||data;
      return session.workspace.role==="manager"?<TouchEditor key={value.version} initial={value} context={context} saved={setSaved} reload={()=>{setSaved(null);read.retry();}} />:
        <DetailRows items={value.touchDelaysMinutes.map((minutes,i)=>({label:"Toque "+(i+1),value:minutes+" minutos"}))} />;
    }}</ReadState>
    <DetailText>Os prazos organizam os próximos contatos. O envio automático depende do consentimento de cada pessoa em cada linha.</DetailText>
  </DetailSection>;
}
