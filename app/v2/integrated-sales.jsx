"use client";
import {useEffect, useState} from "react";
import {Button, ButtonLink, Input, ThemeV3} from "@content-ventures/design-system/v3";
import {Building2, Users} from "lucide-react";
import {SalesFrame} from "../sales-frame";
import {settingsSections} from "../settings-home";
import {DetailPage, DetailRows, DetailText} from "../../src/ui/os/detail";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import skin from "../../src/ui/os/os-theme.module.css";
import gate from "../portal.module.css";
import {CursorNav, ReadState} from "./read-state";
import {ReadOnlyTeamDirectory} from "../team-directory";
import {ConnectedDashboard, ConnectedRadar, Diagnostics} from "./work-queue";
import {ConnectedChannels} from "./channels";
import {ConnectedReturns} from "./seller-work";
import {ConnectedInbox} from "./inbox";
import {ConnectedZoe, ZoeHistory} from "./zoe";
import {BudgetUsage} from "./budget-usage";
import {AcceptInvitation, InviteSeller} from "./invitations";
import {ConnectedCatalog} from "./catalog";
import {ConnectedPipeline} from "./pipeline";
import {ConnectedAlerts} from "./alerts";
import {ConnectedCredits} from "./credits";
import {PasswordRecovery} from "./password-recovery";

const titles = Object.fromEntries(settingsSections.map(x => [x.id, x.title]));
Object.assign(titles, {dashboard:"Dashboard", radar:"Radar", oportunidades:"Negociações",
  entrada:"Conversas", conversa:"Conversa", tarefas:"Retornos", chat:"Chat da Zoe", zoe:"Chat da Zoe",
  resultados:"Ganhos", diagnosticos:"Diagnósticos", crm:"Pipeline comercial", alertas:"Alertas"});
const jump = where => { window.location.hash = where; };
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const sessionEvent = "sa2-session-changed";
let tabId;
function announceSessionChange() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(sessionEvent);
    tabId ??= crypto.randomUUID();
    channel.postMessage(tabId);
    channel.close();
  }
}
function Login({onLogin}) {
  const action = useV2Action();
  const publicAccess = process.env.NEXT_PUBLIC_SALES_ACCESS_MODE === "public";
  return <div className={gate.gate}><form className={gate.login} onSubmit={e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    action.run("auth/session", "POST", {email:form.get("email").trim(), password:form.get("password")}, onLogin);
  }}>
    <img width="36" height="36" alt="" src="/assets/sales-mark.svg" />
    <h1>{publicAccess ? "Entrar no Sales Analyzer" : "Entrar na V2"}</h1>
    <p>{publicAccess ? "Acesse sua empresa com seu e-mail e senha." : "Use sua conta de homologação."}</p>
    <label>E-mail<Input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
    <label>Senha<Input name="password" type="password" required maxLength={256} autoComplete="current-password" /></label>
    {action.error && <p role="alert">{action.error}</p>}
    <Button type="submit" disabled={action.pending}>{action.pending ? "Entrando…" : "Entrar"}</Button>
    <ButtonLink href="#recuperar" variant="ghost">Esqueci minha senha</ButtonLink>
    <ButtonLink href="#convite" variant="ghost">Tenho um convite</ButtonLink>
  </form></div>;
}

function Company({session, context, onSwitch}) {
  const action = useV2Action(context);
  return <DetailPage title="Empresa" icon={Building2} description="Empresa ativa nesta sessão">
    <DetailRows items={[{label:"Empresa", value:session.workspace.name},
      {label:"Conta", value:session.user.email},
      {label:"Acesso", value:session.workspace.role === "manager" ? "Gestor" : "Vendedor"}]} />
    {session.workspaces.length > 1 && <label>Alternar empresa <select aria-label="Alternar empresa"
      value={session.workspace.id} disabled={action.pending} onChange={e => {
        action.run("session/workspace", "PUT", {workspaceId:e.target.value}, onSwitch);
      }}>{session.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
    {action.error && <p role="alert">{action.error}</p>}
    <ButtonLink href="#convite" variant="secondary">Aceitar convite de outra empresa</ButtonLink>
  </DetailPage>;
}

function ConnectedTeam({session,context}) {
  const manager = session.workspace.role === "manager";
  const page = useV2Page(manager ? "team" : null,context);
  return <DetailPage title="Equipe" icon={Users} description={session.workspace.name}
    actions={manager && <InviteSeller workspace={session.workspace} context={context} />}>
    {manager ? <>
      <ReadState read={page}>{({items}) => items.length ? <ReadOnlyTeamDirectory members={items} /> :
        <DetailText>{page.previous ? "Nenhum integrante nesta página." : "Nenhum integrante nesta empresa."}</DetailText>}</ReadState>
      <CursorNav page={page} label="Páginas da equipe" />
    </> : <DetailText>Somente gestores podem consultar a equipe da empresa.</DetailText>}
  </DetailPage>;
}
function Workspace({session, onSession, route, dark, changeTheme}) {
  const context = session.user.id + "/" + session.workspace.id;
  const logout = useV2Action(context);
  const [page, detail, threadId, section, evidence] = route.split("/");
  const [revision, setRevision] = useState(0);
  const title = titles[page] || "Área da empresa";
  const isInbox = page === "entrada" || page === "conversa";
  const isRadar = page === "radar" || page === "oportunidades";
  const isChat = page === "chat" || page === "zoe";
  const chatHistory = useV2Page(isChat ? "zoe/history" : null,context);
  const area = isInbox ? "entrada" : isRadar ? "radar" : page === "zoe" ? "chat" : page;
  const radar = useV2Page(page === "dashboard" ? "radar" : null, context, revision);
  const connections = useV2Page(["whatsapps","diagnosticos"].includes(page) ? "connections" : null, context);
  const detailId = isInbox ? (page === "conversa" ? route.split("/")[1] : threadId) : undefined;
  const refresh = () => setRevision(x => x + 1);
  const signOut = () => logout.run("auth/session", "DELETE", undefined, () => {announceSessionChange(); onSession(null);});
  let content;
  if (page === "dashboard" || page === "resultados")
    content = <ConnectedDashboard radar={radar} context={context} session={session} gains={page === "resultados"} />;
  else if (isRadar) content = <ConnectedRadar key={page} context={context} title={title} />;
  else if (isChat) content = <ConnectedZoe route={route} session={session} context={context} history={chatHistory} />;
  else if (isInbox) content = <ConnectedInbox revision={revision} id={detailId}
    validId={uuid.test(detailId || "")} context={context} session={session} refresh={refresh}
    evidence={section === "evidencia" ? evidence : undefined} />;
  else if (page === "tarefas") content = <ConnectedReturns context={context} />;
  else if (page === "diagnosticos") content = <Diagnostics manager={session.workspace.role === "manager"} key={detail || page} initialId={uuid.test(detail || "") ? detail : null} context={context} connections={connections} />;
  else if (page === "conexao" || page === "whatsapps") content = <ConnectedChannels key={page} catalog={page === "conexao"}
    session={session} context={context} connections={connections} />;
  else if (page === "empresa" || page === "ajustes") content = <Company session={session} context={context}
    onSwitch={value => {announceSessionChange(); jump("empresa"); onSession(value);}} />;
  else if (page === "uso") content = <BudgetUsage session={session} context={context} />;
  else if (page === "equipe") content = <ConnectedTeam session={session} context={context} />;
  else if (page === "crm") content = <ConnectedPipeline session={session} context={context} />;
  else if (page === "alertas") content = <ConnectedAlerts session={session} context={context} />;
  else if (page === "catalogo") content = <ConnectedCatalog session={session} context={context} />;
  else if (page === "plano") content = <ConnectedCredits session={session} context={context} />;
  else content = <DetailPage title={title}><DetailText>Esta área ainda aguarda integração com o backend da V2.</DetailText>
    <a href="#radar">Abrir Radar</a></DetailPage>;
  return <SalesFrame route={route} area={area} title={title} live={{session, logout:signOut}} threads={{}}
    chatHistory={isChat && <ZoeHistory history={chatHistory} route={route} />}
    dark={dark} changeTheme={changeTheme} ask={() => jump("chat")}>
    <title>{title + " · Sales Analyzer"}</title>
    {logout.error && <p role="alert">{logout.error}</p>}{content}
  </SalesFrame>;
}

export function IntegratedSales() {
  const [epoch, setEpoch] = useState(0);
  const [session, setSession] = useState(undefined);
  const [route, setRoute] = useState("dashboard");
  const [dark, setDark] = useState(false);
  const initial = useV2Read(session === undefined ? "session" : null, undefined, epoch);
  useEffect(() => {
    function changeRoute() {setRoute(window.location.hash.slice(1) || "dashboard");}
    function resync() {setSession(undefined); setEpoch(v => v + 1);}
    changeRoute();
    setDark(localStorage.getItem("sales-v2-integrated-theme") === "dark");
    window.addEventListener("hashchange", changeRoute);
    window.addEventListener(sessionEvent, resync);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(sessionEvent) : null;
    if (channel) channel.onmessage = e => {if (e.data !== tabId) resync();};
    return () => {window.removeEventListener("hashchange", changeRoute);
      window.removeEventListener(sessionEvent, resync); channel?.close();};
  }, []);
  useEffect(() => {
    if (session !== undefined) return;
    if (initial.data) setSession(initial.data);
    else if (initial.error?.status === 401) setSession(null);
  }, [initial.data, initial.error, session]);
  return <ThemeV3 className={skin.brand} mode={dark ? "dark" : "light"}>
    <ThemeV3 className={skin.mono + " sales-surface"}>
      {route === "convite" && session !== undefined ? <AcceptInvitation session={session} key={session?.user.id || "guest"}
        onSwitch={value => {announceSessionChange();setSession(value);jump("dashboard");}}
        showCompanies={() => {setSession(undefined);setEpoch(v => v + 1);jump("empresa");}} /> :
        session ? <Workspace key={session.user.id + session.workspace.id} session={session} onSession={setSession}
        route={route} dark={dark} changeTheme={() => {localStorage.setItem("sales-v2-integrated-theme", dark ? "light" : "dark"); setDark(!dark);}} /> :
        session === null ? route === "recuperar" ? <PasswordRecovery /> :
          <Login onLogin={value => {announceSessionChange(); setSession(value);}} /> :
        <div className={gate.gate} data-sales-mode="integrated"><ReadState read={initial}>{() => <p>Carregando empresa…</p>}</ReadState></div>}
    </ThemeV3>
  </ThemeV3>;
}
