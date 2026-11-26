"use client";
import {useEffect, useState} from "react";
import {Button, ButtonLink, Input} from "@content-ventures/design-system/v3";
import {Cpu} from "lucide-react";
import {DetailPage, DetailText} from "../../src/ui/os/detail";
import {Pills} from "../../src/ui/os/pills";
import {useV2Action, useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import {AiCatalog} from "./central-ai-catalog";
import {AiRoutes} from "./central-ai-routes";
import {AiOverview} from "./central-ai-overview";
import css from "./central-ai.module.css";
import gate from "../portal.module.css";

function StaffLogin({done}) {
  const action=useV2Action();
  return <div className={gate.gate}><form className={gate.login} onSubmit={event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    action.run("staff/auth/session","POST",{email:form.get("email").trim(),password:form.get("password")},done);
  }}>
    <h1>Central de IA</h1><p>Entre com sua conta da equipe administrativa.</p>
    <label>E-mail<Input name="email" type="email" required autoComplete="username" /></label>
    <label>Senha<Input name="password" type="password" required autoComplete="current-password" /></label>
    {action.error && <p role="alert">{action.error}</p>}
    <Button type="submit" disabled={action.pending}>{action.pending ? "Entrando…" : "Entrar na Central"}</Button>
    <ButtonLink href="#dashboard" variant="ghost">Voltar ao produto</ButtonLink>
  </form></div>;
}
function StaffFactor({session,done}) {
  const action=useV2Action(), enroll=session.secondFactor.state==="enroll";
  const [secret,setSecret]=useState(null), [reserve,setReserve]=useState(null);
  if (reserve) return <DetailPage title="Guarde seus códigos de reserva">
    <DetailText>Cada código vale uma vez. Guarde em um local privado antes de continuar.</DetailText>
    <pre>{reserve.reserveCodes.join("\n")}</pre><Button onClick={()=>done(reserve.session)}>Continuar para a Central</Button>
  </DetailPage>;
  return <DetailPage title={enroll ? "Configurar segundo fator" : "Confirmar segundo fator"}>
    {enroll && !secret && <Button onClick={()=>action.run("staff/factor/secret","POST",{},setSecret)}>Preparar autenticador</Button>}
    {secret && <><DetailText>Adicione esta chave ao seu aplicativo autenticador.</DetailText><code>{secret.secret}</code></>}
    {(!enroll || secret) && <form className="flow" onSubmit={event=>{
      event.preventDefault();const code=new FormData(event.currentTarget).get("code");
      action.run("staff/factor","POST",{code},value=>value.reserveCodes ? setReserve(value) : done(value.session));
    }}>
      <label>Código do autenticador ou de reserva<Input name="code" required autoComplete="one-time-code" maxLength={24} /></label>
      <Button type="submit" disabled={action.pending}>Confirmar código</Button>
    </form>}
    {action.error && <p role="alert">{action.error}</p>}
  </DetailPage>;
}
function Library({staff}) {
  const [tab,setTab]=useState("routes"), [revision,setRevision]=useState(0);
  const catalog=useV2Read("staff/ai/catalog",undefined,revision);
  const refresh=()=>setRevision(v=>v+1);
  if (catalog.error?.status===404) return <DetailText>A biblioteca ainda não foi ativada neste ambiente.</DetailText>;
  return <>
    <Pills label="Áreas da Central de IA" value={tab} onChange={setTab} items={[
      {value:"routes",label:"Modelos por função"},{value:"catalog",label:"Biblioteca"},{value:"overview",label:"Custo e operação"},
    ]} />
    <ReadState read={catalog}>{data=>tab==="catalog" ? <AiCatalog data={data} refresh={refresh} /> :
      tab==="routes" ? <AiRoutes key={revision} catalog={data} /> : <AiOverview canEdit={data.canEdit} settings={data.settings} refreshCatalog={refresh} />}</ReadState>
    {staff.role!=="owner" && <DetailText>Seu perfil permite consultar as configurações.</DetailText>}
  </>;
}
export function CentralAi() {
  const [session,setSession]=useState(undefined), [revision,setRevision]=useState(0);
  useEffect(()=>{const expired=()=>setSession(null);window.addEventListener("sa2-staff-session-ended",expired);return()=>window.removeEventListener("sa2-staff-session-ended",expired);},[]);
  const read=useV2Read(session===undefined?"staff/session":null,undefined,revision), logout=useV2Action();
  const current=session===undefined?read.data:session;
  if (session===null || session===undefined && read.error?.status===401) return <StaffLogin done={setSession} />;
  if (!current) return <main className={css.central}><ReadState read={read} /></main>;
  return <main className={css.central}>
    <DetailPage title="Central de IA" icon={Cpu} description={current.staff.name+" · Administração do motor da Zoe"}
      actions={<><ButtonLink href="#dashboard" variant="ghost" size="sm">Abrir produto</ButtonLink>
        <Button size="sm" variant="secondary" disabled={logout.pending} onClick={()=>logout.run("staff/session","DELETE",undefined,()=>setSession(null))}>Sair da Central</Button></>}>
      {logout.error && <p role="alert">{logout.error}</p>}
      {current.secondFactor.state!=="verified" ? <StaffFactor session={current} done={setSession} /> : <Library key={current.staff.id} staff={current.staff} />}
      {read.error?.status===403 && <Button onClick={()=>{setSession(undefined);setRevision(v=>v+1);}}>Conferir acesso</Button>}
    </DetailPage>
  </main>;
}
