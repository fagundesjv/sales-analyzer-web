"use client";
import {useEffect, useRef, useState} from "react";
import {Badge, Button, ButtonLink} from "@content-ventures/design-system/v3";
import {Plug, QrCode, Smartphone} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {DetailPage,DetailSection} from "../../src/ui/os/detail";
import {EmptyState, FirstAccess} from "../../src/ui/os/empty-state";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {canCreateWhatsApp,isWhatsAppLine} from "../../lib/v2-capabilities";
import {ReadState,CursorNav} from "./read-state";
import {CreateConnection,isLineReceipt} from "./create-whatsapp";
import {DailySchedule} from "./diagnostic-schedule";
import s from "./channels.module.css";

const stateLabel = {connected:"Conectado",connecting:"Aguardando conexão",disconnected:"Desconectado",
  provisioning:"Preparando conexão",unavailable:"Indisponível",unknown:"Estado a verificar"};
function isQr(value) {
  return typeof value === "string" && value.length < 500000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value);
}
function ConnectionDialog({line, manager, canProvision, context, onClose, update}) {
  const path = "connections/" + line.id;
  const read = useV2Read(path + "/status",context,0,path);
  const action = useV2Action(context);
  const [pair,setPair] = useState(null);
  const [notice,setNotice] = useState("");
  const latest = useRef({retry:read.retry,update});
  latest.current = {retry:read.retry,update};
  const state = read.data || read.previousData;
  const matches = state?.connectionId === line.id && Object.hasOwn(stateLabel,state.status);
  const status = matches ? state.status : null;
  const preparing = status === "provisioning";
  const ready = status === "connected";
  const busy = read.loading || action.pending;
  const whatsapp = isWhatsAppLine(line) || (matches && isWhatsAppLine(state));
  const code = !ready && isQr(pair?.qrDataUrl) ? pair.qrDataUrl : null;
  useEffect(() => {
    if (ready) {setPair(null);setNotice("");latest.current.update();}
  },[ready]);
  useEffect(() => {
    if ((!preparing && status !== "connecting" && !pair) || ready || read.loading || read.error || action.pending) return;
    // Schedule only after the last status response so a slow connection can finish.
    const timer = setTimeout(()=>latest.current.retry(),5000);
    return ()=>clearTimeout(timer);
  },[preparing,status,pair,ready,read.loading,read.error,action.pending]);
  function requestQr() {
    if (!manager || !matches || busy || preparing || ready) return;
    setPair(null);setNotice("");
    action.run(path+"/pairing","POST",{},result=>{
      if (result?.connectionId === line.id) setPair(result);
      else setNotice("Não foi possível confirmar o código desta linha. Tente novamente.");
      read.retry();
    },{onFailure:error=>{if (error.status === 409) read.retry();}});
  }
  function resume() {
    if (!canProvision || !preparing || busy) return;
    setNotice("");
    action.run(path+"/provision","POST",{},result=>{
      const verified = isLineReceipt(result) && result.connectionId === line.id;
      setNotice(!verified ? "Confira o estado da linha antes de continuar." :
        result.status === "provisioning" ? "A preparação continua. Você pode retomar esta linha pela lista de WhatsApps." : "");
      read.retry();update();
    },{onFailure:()=>{read.retry();update();}});
  }
  const readError = read.error || (state && !matches && new Error("Não foi possível confirmar o estado desta linha."));
  return <ResponsiveDialog open size="md" title={line.name} description={whatsapp ? "WhatsApp da empresa" : "Fonte de teste"}
    dismissible={!action.pending} onClose={()=>{if (!action.pending) onClose();}}>
    {readError || !state ? <ReadState full={false} read={{...read,error:readError}} /> : <div className={s.pairing}>
      <div role="status"><Badge>{stateLabel[status] || stateLabel.unknown}</Badge></div>
      {preparing ? <>
        <p>{manager && canProvision ? "A linha já foi criada. Continue a preparação para liberar o QR Code." :
          "Esta linha está em preparação. Volte para conferir o estado ou fale com o responsável pela implantação."}</p>
        {canProvision && <Button variant="primary" disabled={busy} onClick={resume}>
          {action.pending ? "Preparando…" : "Continuar preparação"}</Button>}
      </> : whatsapp && !ready && status !== "unavailable" ? manager ? <>
        {code ? <figure className={s.code}><img alt="QR Code de pareamento do WhatsApp" src={code} width="216" height="216" />
          <figcaption>No WhatsApp, abra Aparelhos conectados, toque em Conectar aparelho e escaneie o código.</figcaption></figure> :
          <p>{pair ? "O código ainda não está disponível. Gere um novo QR Code em instantes." :
            "Gere o QR Code e escaneie com o WhatsApp que deseja conectar."}</p>}
        <Button variant={code ? "secondary" : "primary"} disabled={busy} icon={QrCode} onClick={requestQr}>
          {action.pending ? "Solicitando…" : code ? "Renovar QR Code" : "Gerar QR Code"}</Button>
      </> : <p>Peça ao gestor para escanear o QR Code desta linha.</p> :
        <p>{!whatsapp ? "Esta fonte usa conversas de exemplo para testar diagnósticos." :
          ready ? "O WhatsApp está conectado e disponível para análise." : "Peça à implantação para verificar esta linha."}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button disabled={busy} variant="ghost" size="sm" onClick={read.retry}>Atualizar estado</Button>
    </div>}
    {action.error && <p role="alert">{action.error}</p>}
    {ready && !readError && <DailySchedule connectionId={line.id} context={context} manager={manager} />}
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
  const canCreate = canCreateWhatsApp(manager,connections.data);
  const keepForm = canCreate || (connections.loading && canCreateWhatsApp(manager,connections.previousData));
  return <>
    <ChannelList manager={manager} connections={connections} canCreate={canCreate}
      openCreate={()=>setCreating(true)} openLine={setLine} />
    {creating && keepForm && <CreateConnection context={context} session={session} allowed={canCreate}
      onClose={()=>setCreating(false)} refresh={connections.retry} onCreated={created=>{
        setCreating(false);setLine(created);connections.first();
      }} />}
    {line && <ConnectionDialog key={line.id} line={line} manager={manager} canProvision={canCreate}
      context={context} update={connections.retry} onClose={()=>setLine(null)} />}
  </>;
}

function ChannelList({manager,connections,canCreate,openCreate,openLine}) {
  if (!connections.confirmed) return <ReadState read={connections} />;
  if (!connections.previous && connections.data?.items.length === 0) return <FirstAccess icon={Smartphone} preview="channels" title={canCreate ?
      "Conecte seu primeiro WhatsApp" : manager ? "WhatsApp ainda não configurado" : "Nenhum número atribuído"}
      description={manager ? canCreate ? "Crie uma linha e escaneie o QR Code para analisar as conversas." :
        "Solicite a configuração à equipe de implantação. Sua linha aparecerá aqui quando estiver disponível." :
        "Peça ao gestor da empresa para conectar ou atribuir uma linha à sua conta."}
      action={canCreate && <Button variant="primary" icon={QrCode} onClick={openCreate}>Conectar WhatsApp</Button>} />;
  return <DetailPage title="WhatsApps" icon={Smartphone}
    actions={canCreate && connections.data?.items.some(isWhatsAppLine) &&
      <Button variant="primary" icon={QrCode} onClick={openCreate}>Conectar WhatsApp</Button>}>
    <ReadState retain read={connections}>{({items}) => {
      const lines = items.filter(isWhatsAppLine);
      const samples = items.filter(c => c.source === "synthetic");
      function row(c) {const resume = canCreate && c.status === "provisioning";
        return <li key={c.id}><span><strong>{c.name}</strong><small>{stateLabel[c.status] || stateLabel.unknown}</small></span>
          <Button variant="secondary" size="sm" aria-label={(resume ? "Continuar conexão de " : "Ver conexão de ") + c.name}
            onClick={() => openLine(c)}>{resume ? "Continuar conexão" : "Ver conexão"}</Button></li>;}
      return <><DetailSection title="Números de WhatsApp">{lines.length ?
        <ul className={s.lines}>{lines.map(row)}</ul> : <EmptyState icon={Smartphone} preview={connections.previous ? undefined : "channels"}
          title={connections.previous ? "Nenhum número nesta página" : canCreate ?
            "Conecte seu primeiro WhatsApp" : manager ? "WhatsApp ainda não configurado" : "Nenhum número atribuído"}
          description={connections.previous ? "Volte à página anterior para conferir os números da operação." : manager ?
            canCreate ? "Crie uma linha e escaneie o QR Code para analisar as conversas." :
            "A conexão desta empresa é preparada com o responsável pela implantação. Quando a linha estiver disponível, ela aparecerá aqui." :
            "Peça ao gestor da empresa para conectar ou atribuir uma linha à sua conta."}
          action={connections.previous ? <Button size="sm" variant="secondary" onClick={connections.previous}>Página anterior</Button> :
            canCreate ? <Button size="sm" variant="primary" icon={QrCode} onClick={openCreate}>Conectar WhatsApp</Button> : null} />}</DetailSection>
        {samples.length > 0 && <DetailSection title="Fontes de teste"><ul className={s.lines}>{samples.map(row)}</ul></DetailSection>}
      </>;
    }}</ReadState>
    <CursorNav page={connections} label="Páginas de conexões" />
  </DetailPage>;
}
