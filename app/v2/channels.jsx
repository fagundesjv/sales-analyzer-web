"use client";
import {useEffect, useRef, useState} from "react";
import {Badge, Button, ButtonLink, Input} from "@content-ventures/design-system/v3";
import {Plug, QrCode, Smartphone} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {DetailPage,DetailSection} from "../../src/ui/os/detail";
import {EmptyState, FirstAccess} from "../../src/ui/os/empty-state";
import {useV2Action,useV2Page,useV2Read} from "../../lib/v2-client";
import {selfServeWhatsApp} from "../../lib/v2-capabilities";
import {ReadState,CursorNav} from "./read-state";
import {DailySchedule} from "./diagnostic-schedule";
import s from "./channels.module.css";

const stateLabel = {connected:"Conectado",connecting:"Aguardando conexão",disconnected:"Desconectado",
  provisioning:"Preparando conexão",unknown:"Estado a verificar"};
function isQr(value) {
  return typeof value === "string" && value.length < 500000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value);
}
function ConnectionDialog({line, session, context, onClose, update}) {
  const path = "connections/" + line.id;
  const [provisioning,setProvisioning] = useState(line.status === "provisioning");
  const read = useV2Read(provisioning ? null : path + "/status",context);
  const action = useV2Action(context);
  const provision = useV2Action(context);
  const [pair,setPair] = useState(null);
  const [requested,setRequested] = useState(false);
  const status = read.data?.status;
  const latest = useRef({retry:read.retry,update});
  latest.current = {retry:read.retry,update};
  useEffect(() => {
    if (status === "connected") {setPair(null);setRequested(false);latest.current.update();}
    if (status === "provisioning") setProvisioning(true);
  }, [status]);
  useEffect(() => {
    if (!requested || read.error || status === "connected") return;
    const interval = setInterval(() => latest.current.retry(),5000);
    return () => clearInterval(interval);
  }, [requested,read.error,status]);
  function requestQr() {
    setPair(null);
    action.run(path + "/pairing","POST",{}, result => {
      if (result.connectionId === line.id) {
        setPair(result);setRequested(result.status !== "connected");
      }
      read.retry();
    });
  }
  const whatsapp = line.channel === "whatsapp" || line.source === "evolution";
  return <ResponsiveDialog open size="md" title={line.name} description={whatsapp ? "WhatsApp da empresa" : "Fonte de teste"}
    dismissible={!action.pending && !provision.pending} onClose={() => {if (!action.pending && !provision.pending) onClose();}}>
    {provisioning ? <div className="flow">
      <p role="status"><Badge>{stateLabel.provisioning}</Badge></p>
      <p>{session.workspace.role === "manager" && selfServeWhatsApp ?
        "A linha está sendo preparada. Verifique o estado para continuar ao QR Code." :
        "Esta linha está em preparação. Consulte o responsável pela implantação e volte para conferir o estado."}</p>
      {provision.error && <p role="alert">{provision.error}</p>}
      {session.workspace.role === "manager" && selfServeWhatsApp && <Button variant="primary" disabled={provision.pending} onClick={() => provision.run(path + "/provision","POST",{},result => {
        if (result.status !== "provisioning") {setProvisioning(false);update();}
      })}>{provision.pending ? "Verificando…" : "Verificar conexão"}</Button>}
    </div> : <ReadState read={read}>{state => {
      const isWhatsApp = whatsapp || state.channel === "whatsapp" || state.source === "evolution";
      const ready = state.status === "connected";
      const code = !ready && isQr(pair?.qrDataUrl) ? pair.qrDataUrl : null;
      return <div className="flow"><p role="status"><Badge>{stateLabel[state.status] || stateLabel.unknown}</Badge></p>
        {line.justCreated && !ready && <p>Linha criada. Gere o QR Code e escaneie com o WhatsApp que deseja conectar.</p>}
        {isWhatsApp && !ready && session.workspace.role === "manager" && <>
          {code && <figure className={s.code}><img alt="QR Code de pareamento do WhatsApp" src={code} width="216" height="216" />
            <figcaption>No WhatsApp, abra Aparelhos conectados e escaneie este código.</figcaption></figure>}
          {requested && !code && <p role="status">O QR Code ainda não está disponível. Tente renovar em instantes.</p>}
          <Button disabled={action.pending} icon={QrCode} onClick={requestQr}>{action.pending ? "Solicitando…" : code ? "Renovar QR Code" : "Gerar QR Code"}</Button>
        </>}
        {isWhatsApp && !ready && session.workspace.role !== "manager" &&
          <p>Peça ao gestor para escanear o QR Code desta linha.</p>}
        {!isWhatsApp && <p>Esta fonte usa conversas de exemplo para testar diagnósticos.</p>}
        {action.error && <p role="alert">{action.error}</p>}
        <Button disabled={read.refreshing || action.pending} variant="ghost" onClick={read.retry}>Atualizar estado</Button>
      </div>;
    }}</ReadState>}
    {!provisioning && <DailySchedule connectionId={line.id} context={context} manager={session.workspace.role === "manager"} />}
  </ResponsiveDialog>;
}

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
function CreateConnection({session,context,onClose,onCreated,onUnconfirmed}) {
  const [name,setName] = useState("");
  const [ownerId,setOwnerId] = useState("");
  const [members,setMembers] = useState([]);
  const [unconfirmed,setUnconfirmed] = useState(false);
  const action = useV2Action(context);
  const team = useV2Page("team",context,0,100);
  useEffect(() => {
    if (!team.data?.items) return;
    setMembers(current => [...new Map([...current,...team.data.items].map(member => [member.id,member])).values()]);
  },[team.data]);
  const trimmed = name.trim();
  return <ResponsiveDialog open size="sm" title="Conectar WhatsApp"
    description="Dê um nome ao número para identificá-lo na operação."
    dismissible={!action.pending} onClose={() => {if (!action.pending) onClose();}}>
    <form className={s.create} onSubmit={event => {
      event.preventDefault();
      if (trimmed.length < 2 || action.pending || unconfirmed) return;
      action.run("connections","POST",{name:trimmed,...(ownerId ? {ownerId} : {})},result => {
        if (!uuid.test(result?.connectionId)) {
          setUnconfirmed(true);onUnconfirmed();return;
        }
        onCreated({id:result.connectionId,name:result.name || trimmed,channel:"whatsapp",status:result.status,justCreated:true});
      });
    }}>
      <label>Nome da linha<Input autoFocus required minLength={2} maxLength={60} value={name} disabled={action.pending}
        placeholder="Ex.: Comercial Sul" onChange={event => setName(event.target.value)} /></label>
      <label>Responsável pelo número<select value={ownerId} disabled={action.pending}
        onChange={event => setOwnerId(event.target.value)}>
        <option value="">Minha conta (gestor)</option>
        {members.filter(member => member.id !== session.user.id).map(member =>
          <option key={member.id} value={member.id}>{member.name} · {member.role === "manager" ? "Gestor" : "Vendedor"}</option>)}
      </select></label>
      {team.loading && <ReadState full={false} read={team} />}
      {team.error && <p role="status">Não foi possível carregar a equipe. Você ainda pode conectar o número à sua conta.</p>}
      {team.next && <Button type="button" variant="ghost" size="sm" disabled={action.pending}
        onClick={team.next}>Carregar mais pessoas</Button>}
      <p>Depois de criar a linha, escaneie o QR Code com o WhatsApp que será conectado.</p>
      {action.error && <p role="alert">{action.error}</p>}
      {unconfirmed && <p role="alert">A linha pode ter sido criada, mas não foi possível abrir o pareamento. Confira a lista antes de tentar novamente.</p>}
      <Button type="submit" variant="primary" icon={QrCode} disabled={trimmed.length < 2 || action.pending || unconfirmed}>
        {action.pending ? "Criando linha…" : "Continuar para o QR Code"}</Button>
    </form>
  </ResponsiveDialog>;
}

export function ConnectedChannels({catalog,session,context,connections}) {
  const [line,setLine] = useState(null);
  const [creating,setCreating] = useState(false);
  const manager = session.workspace.role === "manager";
  if (catalog) return <DetailPage title="Conectores" icon={Plug} >
    <section className={s.connector}><img width="32" height="32" src="/assets/whatsapp.svg" alt="" />
      <div><h2>WhatsApp</h2><p>Acompanhe os números da equipe e o estado de cada conexão.</p></div>
      <ButtonLink href="#whatsapps" variant="secondary">{manager ? "Gerenciar WhatsApps" : "Ver meus WhatsApps"}</ButtonLink>
    </section></DetailPage>;
  const dialogs = <>
    {creating && selfServeWhatsApp && <CreateConnection session={session} context={context} onClose={() => setCreating(false)}
      onUnconfirmed={connections.first} onCreated={created => {
      setCreating(false);setLine(created);connections.first();
    }} />}
    {line && <ConnectionDialog key={line.id} line={line} session={session} context={context} update={connections.retry} onClose={() => setLine(null)} />}
  </>;
  if (!connections.confirmed) return <><ReadState read={connections} />{dialogs}</>;
  if (!connections.previous && connections.data?.items.length === 0) return <>
    <FirstAccess icon={Smartphone} preview="channels" title={manager && selfServeWhatsApp ?
      "Conecte seu primeiro WhatsApp" : manager ? "WhatsApp ainda não configurado" : "Nenhum número atribuído"}
      description={manager ? selfServeWhatsApp ? "Crie uma linha e escaneie o QR Code para analisar as conversas." :
        "Solicite a configuração à equipe de implantação. Sua linha aparecerá aqui quando estiver disponível." :
        "Peça ao gestor da empresa para conectar ou atribuir uma linha à sua conta."}
      action={manager && selfServeWhatsApp && <Button variant="primary" icon={QrCode} onClick={() => setCreating(true)}>Conectar WhatsApp</Button>} />
    {dialogs}</>;
  return <DetailPage title="WhatsApps" icon={Smartphone}
    actions={manager && selfServeWhatsApp && connections.data?.items.some(c => c.channel === "whatsapp" || c.source === "evolution") &&
      <Button variant="primary" icon={QrCode} onClick={() => setCreating(true)}>Conectar WhatsApp</Button>}>
    <ReadState retain read={connections}>{({items}) => {
      const lines = items.filter(c => c.channel === "whatsapp" || c.source === "evolution");
      const samples = items.filter(c => c.source === "synthetic");
      function row(c) {const resume = manager && selfServeWhatsApp && c.status === "provisioning";
        return <li key={c.id}><span><strong>{c.name}</strong><small>{stateLabel[c.status] || stateLabel.unknown}</small></span>
          <Button variant="secondary" size="sm" aria-label={(resume ? "Continuar conexão de " : "Ver conexão de ") + c.name}
            onClick={() => setLine(c)}>{resume ? "Continuar conexão" : "Ver conexão"}</Button></li>;}
      return <><DetailSection title="Números de WhatsApp">{lines.length ?
        <ul className={s.lines}>{lines.map(row)}</ul> : <EmptyState icon={Smartphone} preview={connections.previous ? undefined : "channels"}
          title={connections.previous ? "Nenhum número nesta página" : manager && selfServeWhatsApp ?
            "Conecte seu primeiro WhatsApp" : manager ? "WhatsApp ainda não configurado" : "Nenhum número atribuído"}
          description={connections.previous ? "Volte à página anterior para conferir os números da operação." : manager ?
            selfServeWhatsApp ? "Crie uma linha e escaneie o QR Code para analisar as conversas." :
            "A conexão desta empresa é preparada com o responsável pela implantação. Quando a linha estiver disponível, ela aparecerá aqui." :
            "Peça ao gestor da empresa para conectar ou atribuir uma linha à sua conta."}
          action={connections.previous ? <Button size="sm" variant="secondary" onClick={connections.previous}>Página anterior</Button> :
            manager && selfServeWhatsApp ? <Button size="sm" variant="primary" icon={QrCode} onClick={() => setCreating(true)}>Conectar WhatsApp</Button> : null} />}</DetailSection>
        {samples.length > 0 && <DetailSection title="Fontes de teste"><ul className={s.lines}>{samples.map(row)}</ul></DetailSection>}
      </>;
    }}</ReadState>
    <CursorNav page={connections} label="Páginas de conexões" />
    {dialogs}
  </DetailPage>;
}
