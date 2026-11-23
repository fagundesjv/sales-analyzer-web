"use client";
import {useState} from "react";
import {Button, List, ListItem} from "@content-ventures/design-system/v3";
import {Bell, SearchX} from "lucide-react";
import {DetailPage, DetailSection} from "../../src/ui/os/detail";
import {Pills} from "../../src/ui/os/pills";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import {RadarEmpty, useRadarEmpty} from "./radar-empty";
import {CursorNav, ReadState} from "./read-state";
import s from "./alerts.module.css";

const signalLabels = {
  risk: "Venda em risco", loss: "Venda perdida", disconnected: "WhatsApp desconectado",
};
const settingsLabels = {
  risk: "Mostrar vendas em risco", loss: "Mostrar perdas registradas",
  disconnected: "Mostrar desconexões confirmadas do WhatsApp",
};
const readingFilters = [
  {value:"all",label:"Todos"}, {value:"false",label:"Não lidos"}, {value:"true",label:"Lidos"},
];
const showDate = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"});

function RuleForm({value,context,saved,reload}) {
  const action=useV2Action(context);
  const keys=Object.keys(settingsLabels);
  const [selected,setSelected]=useState(() => Object.fromEntries(keys.map(key=>[key,value[key]])));
  const changes=Object.fromEntries(keys.filter(key=>selected[key]!==value[key]).map(key=>[key,selected[key]]));
  const changed=Object.keys(changes).length>0;
  const conflict=action.errorCode==="alert_settings_conflict";
  return <form className={s.rules} onSubmit={event => {
    event.preventDefault();
    if (!changed || conflict || action.pending) return;
    action.run("alerts/settings","PATCH",{...changes,version:value.version},saved);
  }}>
    <fieldset disabled={action.pending} className={s.fields}>
      <legend>Estas regras valem para toda a empresa.</legend>
      {keys.map(key => <label className="check-row" key={key}>
        <input type="checkbox" checked={selected[key]}
          onChange={event=>setSelected(old=>({...old,[key]:event.target.checked}))} />
        {settingsLabels[key]}
      </label>)}
    </fieldset>
    {action.error && <div role="alert">
      <p>{action.error}</p>
      {conflict && <Button type="button" variant="secondary" onClick={reload}>Recarregar regras</Button>}
    </div>}
    <Button type="submit" variant="primary" disabled={!changed || conflict || action.pending}>
      {action.pending ? "Salvando…" : "Salvar regras"}
    </Button>
  </form>;
}
function Rules({context,close,saved}) {
  const [revision,setRevision]=useState(0);
  const read=useV2Read("alerts/settings",context,revision);
  return <ResponsiveDialog open size="sm" title="Regras de alerta" onClose={close}>
    <ReadState read={read}>{value =>
      <RuleForm key={revision+":"+value.version} value={value} context={context}
        saved={saved} reload={()=>setRevision(old=>old+1)} />}</ReadState>
  </ResponsiveDialog>;
}
function AlertItem({alert,context,changed}) {
  const action=useV2Action(context);
  const [updated,setUpdated]=useState(undefined);
  const readAt=updated===undefined ? alert.readAt : updated;
  const label=readAt ? "Marcar como não lido" : "Marcar como lido";
  const stamp=alert.fromHistory ? "Sinal do histórico" : showDate.format(new Date(alert.raisedAt));
  const href=alert.conversationId ? "#entrada/todos/"+alert.conversationId : "#whatsapps";
  const description=[signalLabels[alert.kind],alert.detail,stamp].filter(Boolean).join(" · ");
  return <ListItem title={alert.title} description={description} href={href} actions={<div className={s.action}>
    <Button variant="ghost" size="sm" disabled={action.pending}
      aria-label={label+" — "+alert.title}
      onClick={()=>action.run("alerts/"+alert.id+"/read","PUT",{read:!readAt},receipt=>{
        setUpdated(receipt.readAt);
        changed();
      })}>{action.pending ? "Salvando…" : label}</Button>
    {action.error && <small role="alert">{action.error}</small>}
  </div>} />;
}
export function ConnectedAlerts({session,context}) {
  const [readFilter,setReadFilter]=useState("all");
  const [kind,setKind]=useState("");
  const [rules,setRules]=useState(false);
  const [notice,setNotice]=useState("");
  const manager=session.workspace.role==="manager";
  const params=new URLSearchParams();
  if (readFilter!=="all") params.set("read",readFilter);
  if (kind) params.set("kind",kind);
  const page=useV2Page(params.size ? "alerts?"+params : "alerts",context);
  const baselineEmpty = !params.size && !page.previous && page.data?.items.length === 0;
  const empty = useRadarEmpty(baselineEmpty,session,context);
  function saved() {
    setRules(false);
    setNotice("Regras salvas.");
    page.first();
  }
  function openRules() {setNotice("");setRules(true);}
  const dialog = rules && <Rules context={context} close={()=>setRules(false)} saved={saved} />;
  if (!page.confirmed || (!params.size && !page.previous && page.loading && page.previousData?.items.length === 0 && !rules))
    return <ReadState read={page} />;
  if (baselineEmpty && !empty.data) return <ReadState read={empty} />;
  if (baselineEmpty)
    return <><RadarEmpty kind="alerts" step={empty.data.step}
      openRules={manager ? openRules : undefined} notice={notice} />{dialog}</>;
  return <div data-stable-phone-tabs><DetailPage title="Alertas" icon={Bell}
    actions={manager &&
      <Button variant="secondary" onClick={openRules}>Regras de alerta</Button>}>
    {notice && <p role="status">{notice}</p>}
    <DetailSection title="Alertas ativos">
      <div className={s.toolbar}>
        <Pills label="Filtrar por leitura" items={readingFilters} value={readFilter}
          onChange={value=>{setReadFilter(value);setNotice("");}} />
        <label>Tipo de alerta<select aria-label="Tipo de alerta" value={kind}
          onChange={event=>{setKind(event.target.value);setNotice("");}}>
          <option value="">Todos os tipos</option>
          {Object.entries(signalLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}
        </select></label>
      </div>
      <CursorNav label="Páginas de alertas" page={page} className={s.pager} />
      <ReadState retain read={page}>{data=>data.items.length ? <List label="Lista de alertas">
        {data.items.map(alert=><AlertItem alert={alert} key={alert.id+":"+(alert.readAt??"")} context={context}
          changed={()=>{if (readFilter!=="all") page.retry();}} />)}
      </List> : <EmptyState icon={SearchX}
        title={page.previous ? "Esta página está vazia" : "Nenhum alerta com estes filtros"}
        description={page.previous ? "Volte para a página anterior de alertas." : "Tente outra combinação de leitura e tipo."}
        action={<Button variant="secondary" size="sm" onClick={page.previous || (() => {setReadFilter("all");setKind("");})}>
          {page.previous ? "Página anterior" : "Limpar filtros"}</Button>} />}</ReadState>
    </DetailSection>
    {dialog}
  </DetailPage></div>;
}
